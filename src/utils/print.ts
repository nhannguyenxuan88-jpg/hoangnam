export function printElementById(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Print</title>
  <style>
    body{font-family: Arial, Helvetica, sans-serif;}
    @media print{ .no-print{ display:none } }
  </style>
  </head><body>${el.outerHTML}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}
