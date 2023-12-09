import axios from 'axios';
import OpenAI from 'openai';

const { PuppeteerWebBaseLoader } = require('langchain/document_loaders/web/puppeteer');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { HtmlToTextTransformer } = require('langchain/document_transformers/html_to_text');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');

// get env variables
require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;

const openai_client = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Uses SerpApi to get the top 3 results from Google Search.
 * @param query query of user
 * @returns Google search results given the query
 */
async function getGoogleSearchResults(query: string): Promise<string[]> {
  try {
    console.log(`Google Search for: ${query}`);
    const response = await axios.get(`https://serpapi.com/search.json?api_key=${SERP_API_KEY}&engine=google&q=${query}`);
    console.log(`Google Search successful`);

    // get top 3 results
    const results = response.data.organic_results.slice(0, 3);

    // get link of each result
    const links = results.map((result: any) => result.link) as string[];

    return links;
  } catch (error) {
    console.error('Google Search failed:', error);
    return [];
  }
}

/**
 * Each link is a page to be searched. Due to the large size of each page, an in-memory
 * vector db is created for each page and the query is performed on the db to find the 
 * most relevant chunks within the page.
 * @param link URL of page
 * @param query query of user
 * @returns relevant summaries from each page given the query
 */
async function getRelevantContexts(link: string, query: string): Promise<string[]> {
  const loader = new PuppeteerWebBaseLoader(link);
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter("html");
  const transformer = new HtmlToTextTransformer();

  const sequence = splitter.pipe(transformer);

  const chunks = await sequence.invoke(docs);

  console.log(`Loading ${chunks.length} chunks`);

  // load all documents/chunks into a vector store
  const vectorStore = await MemoryVectorStore.fromDocuments(
    chunks,
    new OpenAIEmbeddings()
  );

  console.log(`Loaded ${chunks.length} chunks`);

  // search for the most similar chunks given the query
  // 2
  const similarChunks = await vectorStore.similaritySearch(query, 2);

  return similarChunks.map((result: any) => result.pageContent);;
}

async function generateSummary(query: string, contexts: string): Promise<string> {
  try {
    const chatCompletion = await openai_client.chat.completions.create({
      messages: [
        { role: 'system', content: `Make a summary of 200 words for this request: ${query} and look for it in the following data: ${contexts}` }
      ],
      model: 'gpt-3.5-turbo-16k',
      max_tokens: 512,
    });
    return chatCompletion.choices[0].message.content ?? '';
  } catch (error) {
    console.error('Summary failed:', error);
    return '';
  }
}

export async function browseWeb(query: string): Promise<string> {
  try {
    const links = await getGoogleSearchResults(query);
    const contexts = (await Promise.all(links.map((link: string) => getRelevantContexts(link, query)))).join('\n');
    const summary = await generateSummary(query, contexts);

    // print first line of summary
    console.log(summary.split('\n')[0]);

    return "Here is what I found on the web. " + summary;
  } catch (error) {
    console.error('Error browsing the web:', error);
    return 'I am sorry, something went wrong.';
  }
}
