export function useExport() {
  function downloadCsv(filename, headers, rows) {
    const csvRows = [];
    csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
    
    rows.forEach(row => {
      csvRows.push(row.map(val => `"${String(val !== null && val !== undefined ? val : '').replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n'); // 加入 UTF-8 BOM 防止 Excel 亂碼
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return { downloadCsv };
}
