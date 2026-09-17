/**
 * Renders a JSON-LD structured-data block.
 *
 * React escapes text children, so the payload goes in through
 * dangerouslySetInnerHTML. Every "<" is re-encoded as < — JSON-LD is data,
 * not script, and that stops a string in the data from closing the <script>
 * element early. Placement doesn't matter to Google, so this renders inline
 * wherever the page puts it.
 */
export function JsonLd({ data }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
