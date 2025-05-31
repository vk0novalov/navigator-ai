import { Defuddle } from 'defuddle/node';
import * as cheerio from 'cheerio';

export function normalizeUrl(rawUrl, baseUrl) {
  try {
    const url = new URL(rawUrl, baseUrl);
    // Remove fragment and query for normalization
    url.hash = '';
    url.search = '';
    // Ensure trailing slash only for root paths
    if (!url.pathname.endsWith('/')) {
      // Add trailing slash only if it's not a file (no extension)
      if (!url.pathname.split('/').pop().includes('.')) {
        url.pathname += '/';
      }
    }
    return url.toString();
  } catch (err) {
    console.error(`Invalid URL: ${url}`, err);
    return null;
  }
}

const parseUrls = (html, BASE_URL) => {
  const $ = cheerio.load(html);
  const links = $('a[href]')
    .map((_, el) => $(el).attr('href'))
    .get();
  return links
    .map((link) => {
      if (link.startsWith('/') || link.startsWith(BASE_URL)) return normalizeUrl(link, BASE_URL);
      return null;
    })
    .filter(Boolean);
};

export async function parseFromHTML(html, BASE_URL) {
  const result = await Defuddle(html);
  result.urls = parseUrls(html, BASE_URL);
  return result;
}
