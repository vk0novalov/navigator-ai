import * as cheerio from 'cheerio';
import { Defuddle } from 'defuddle/node';
import { convert } from 'html-to-text';

const blacklist = ['favicon.', 'apple-touch-icon.', 'apple-touch-icon-precomposed.'];

const isLinkApplicable = (link, baseUrl) => {
  return (
    link &&
    !blacklist.some((b) => link.includes(b)) &&
    (link.startsWith('/') || link.startsWith(baseUrl))
  );
};

export function normalizeUrl(rawUrl, baseUrl) {
  try {
    const url = new URL(rawUrl, baseUrl);
    // Remove fragment and query for normalization
    url.hash = '';
    url.search = '';
    if (url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch (err) {
    console.error(`Invalid URL: ${url}`, err);
    return null;
  }
}

const parseUrls = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const links = $('a[href]')
    .map((_, el) => $(el).attr('href'))
    .get();
  return links
    .filter((link) => isLinkApplicable(link, baseUrl))
    .map((link) => normalizeUrl(link, baseUrl))
    .filter(Boolean);
};

export async function parseFromHTML(html, baseUrl) {
  if (!html || typeof html !== 'string') {
    throw new Error('Invalid HTML content provided for parsing.');
  }
  if (html.length < 100) {
    return null;
  }
  const result = await Defuddle(html);
  result.content = convert(result.content, {
    wordwrap: false, // не ставить перенос кожні 80 символів
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
    ],
  });
  result.urls = parseUrls(html, baseUrl);
  return result;
}
