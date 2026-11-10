/* Kanawa Soft ERP — pesquisa e ordenação consistentes nas tabelas dos módulos. */
(function () {
  'use strict';

  const STYLE_ID = 'kanawa-table-enhancements-style';
  const collator = new Intl.Collator('pt-AO', { numeric: true, sensitivity: 'base' });

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.ks-table-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 10px;padding:9px 11px;background:var(--bg-hover);border:1px solid var(--border);border-radius:10px}',
      '.ks-table-search{display:flex;align-items:center;gap:8px;flex:1 1 220px;min-width:0;color:var(--text-muted);font-size:.82rem;font-weight:600}',
      '.ks-table-search input{width:100%;max-width:360px;min-width:0;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);font:inherit}',
      '.ks-table-count{color:var(--text-muted);font-size:.78rem;white-space:nowrap}',
      '.table-wrap thead th.ks-table-sortable{white-space:nowrap;cursor:pointer;user-select:none}',
      '.table-wrap thead th.ks-table-sortable::after{content:"↕";display:inline-block;margin-left:6px;opacity:.55;font-size:.72em}',
      '.table-wrap thead th.ks-table-sortable[aria-sort="ascending"]::after{content:"↑";opacity:1}',
      '.table-wrap thead th.ks-table-sortable[aria-sort="descending"]::after{content:"↓";opacity:1}',
      '.table-wrap thead th.ks-table-sortable:focus-visible,.ks-table-search input:focus-visible{outline:2px solid var(--info);outline-offset:2px;border-radius:4px}',
      '.table-wrap tbody tr[hidden]{display:none!important}',
      '@media(max-width:600px){.ks-table-toolbar{align-items:stretch}.ks-table-search{flex-basis:100%}.ks-table-search input{max-width:none}.ks-table-count{align-self:flex-end}}'
    ].join('');
    document.head.appendChild(style);
  }

  function sortValue(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text) return { type: 'text', value: '' };
    if (/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(text)) {
      const date = Date.parse(text);
      if (Number.isFinite(date)) return { type: 'number', value: date };
    }
    const numeric = text.replace(/\s/g, '').replace(/[^\d,.-]/g, '');
    if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(numeric)) {
      return { type: 'number', value: Number(numeric.replace(/\./g, '').replace(',', '.')) };
    }
    if (/^-?\d+(?:[,.]\d+)?$/.test(numeric) && numeric === text.replace(/\s/g, '')) {
      return { type: 'number', value: Number(numeric.replace(',', '.')) };
    }
    return { type: 'text', value: text };
  }

  function enhanceTable(wrapper) {
    if (!wrapper || wrapper.dataset.kanawaTableEnhanced === 'true') return;
    const table = wrapper.querySelector('table');
    const body = table && (table.tBodies && table.tBodies[0] || table.querySelector('tbody'));
    const head = table && (table.tHead && table.tHead.rows[0] || table.querySelector('thead tr'));
    if (!table || !body || !head || !body.rows.length) return;

    const rows = Array.from(body.rows);
    const toolbar = document.createElement('div');
    toolbar.className = 'ks-table-toolbar';

    const label = document.createElement('label');
    label.className = 'ks-table-search';
    label.textContent = 'Pesquisar nesta tabela';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Escreva para filtrar registos...';
    input.setAttribute('aria-label', 'Pesquisar registos nesta tabela');
    label.appendChild(input);

    const count = document.createElement('span');
    count.className = 'ks-table-count';
    count.setAttribute('aria-live', 'polite');
    toolbar.appendChild(label);
    toolbar.appendChild(count);
    wrapper.insertBefore(toolbar, table);

    function updateCount() {
      const visible = rows.filter(row => !row.hidden).length;
      count.textContent = visible + ' de ' + rows.length + ' registos';
    }

    input.addEventListener('input', function () {
      const query = input.value.trim().toLocaleLowerCase('pt-AO');
      rows.forEach(row => {
        row.hidden = !!query && !String(row.textContent || '').toLocaleLowerCase('pt-AO').includes(query);
      });
      updateCount();
    });

    Array.from(head.cells).forEach((cell, columnIndex) => {
      cell.classList.add('ks-table-sortable');
      cell.tabIndex = 0;
      cell.setAttribute('aria-label', 'Ordenar por ' + String(cell.textContent || '').trim());

      function sortByColumn() {
        const direction = cell.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
        Array.from(head.cells).forEach(other => {
          delete other.dataset.sortDirection;
          other.removeAttribute('aria-sort');
        });
        cell.dataset.sortDirection = direction;
        cell.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');

        const ordered = Array.from(body.rows).map((row, index) => ({ row, index }));
        ordered.sort((left, right) => {
          const a = sortValue(left.row.cells[columnIndex] && left.row.cells[columnIndex].textContent);
          const b = sortValue(right.row.cells[columnIndex] && right.row.cells[columnIndex].textContent);
          let comparison = a.type === 'number' && b.type === 'number'
            ? a.value - b.value
            : collator.compare(String(a.value), String(b.value));
          if (!Number.isFinite(comparison)) comparison = 0;
          return (direction === 'asc' ? comparison : -comparison) || left.index - right.index;
        });
        ordered.forEach(item => body.appendChild(item.row));
        updateCount();
      }

      cell.addEventListener('click', sortByColumn);
      cell.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          sortByColumn();
        }
      });
    });

    wrapper.dataset.kanawaTableEnhanced = 'true';
    updateCount();
  }

  function apply(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    installStyles();
    const wrappers = Array.from(root.querySelectorAll('.table-wrap'));
    wrappers.forEach(enhanceTable);
    return wrappers.length;
  }

  window.KanawaTableEnhancements = Object.freeze({ apply });
})();
