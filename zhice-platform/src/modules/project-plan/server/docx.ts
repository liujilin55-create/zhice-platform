import "server-only";
import JSZip from "jszip";

function xml(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function paragraph(line: string) {
  const heading = line.match(/^(#{1,3})\s+(.*)$/);
  const text = heading?.[2] || line || " ";
  const size = heading ? (heading[1].length === 1 ? 36 : heading[1].length === 2 ? 28 : 24) : 21;
  const bold = heading ? "<w:b/>" : "";
  return `<w:p><w:pPr>${heading ? `<w:spacing w:before=\"${heading[1].length === 1 ? 260 : 160}\" w:after=\"100\"/>` : ""}</w:pPr><w:r><w:rPr>${bold}<w:sz w:val=\"${size}\"/><w:szCs w:val=\"${size}\"/></w:rPr><w:t xml:space=\"preserve\">${xml(text)}</w:t></w:r></w:p>`;
}

/** Build a small, standards-compliant OOXML package without pretending Markdown is DOCX. */
export async function createDocxBase64(markdown: string) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${markdown.split(/\r?\n/).map(paragraph).join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", documentXml);
  return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
}
