import ExcelJS from 'exceljs';

/** columns: [{ header, key, width }] */
export async function sendExport(res, format, filename, columns, rows) {
  if (format === 'csv') {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [columns.map((c) => esc(c.header)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('TrackX');
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16 }));
  rows.forEach((r) => ws.addRow(r));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FF3D2E00' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCEFB0' } };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}
