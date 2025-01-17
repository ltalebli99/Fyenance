const ITEMS_PER_PAGE = 10;

export class TablePagination {
  constructor(tableId, options = {}) {
    this.tableId = tableId;
    this.currentPage = 1;
    this.itemsPerPage = options.itemsPerPage || ITEMS_PER_PAGE;
    this.totalItems = 0;
    this.tableBody = document.getElementById(tableId);
    this.paginationContainer = this.createPaginationContainer();
    
    // Add callback property
    this.onPageChangeCallback = options.onPageChange || null;
    
    // Insert pagination container after table
    if (this.tableBody) {
      this.tableBody.parentElement.insertAdjacentElement('afterend', this.paginationContainer);
    }
  }

  resetToFirstPage() {
    this.currentPage = 1;
    this.updatePagination(this.totalItems);
    if (this.onPageChangeCallback) {
      this.onPageChangeCallback(1);
    }
  }

  createPaginationContainer() {
    const container = document.createElement('div');
    container.className = 'pagination';
    container.innerHTML = `
      <div class="pagination-controls-left">
        <select class="items-per-page-select">
          <option value="10">10 per page</option>
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
        </select>
      </div>
      <div class="pagination-info">
        Showing <span class="showing-start">0</span>-<span class="showing-end">0</span> of <span class="total-items">0</span>
      </div>
      <div class="pagination-controls">
        <button class="prev-page" disabled>
          <i class="fas fa-chevron-left"></i>
          Previous
        </button>
        <div class="page-numbers"></div>
        <button class="next-page" disabled>
          Next
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    `;

    // Add event listeners
    container.querySelector('.prev-page').addEventListener('click', () => this.previousPage());
    container.querySelector('.next-page').addEventListener('click', () => this.nextPage());
    container.querySelector('.items-per-page-select').addEventListener('change', (e) => {
      this.itemsPerPage = parseInt(e.target.value);
      this.currentPage = 1;
      this.onPageChange(this.currentPage);
    });

    return container;
  }

  updatePagination(totalItems) {
    this.totalItems = totalItems;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    const start = ((this.currentPage - 1) * this.itemsPerPage) + 1;
    const end = Math.min(start + this.itemsPerPage - 1, totalItems);

    // Update info text
    this.paginationContainer.querySelector('.showing-start').textContent = totalItems ? start : 0;
    this.paginationContainer.querySelector('.showing-end').textContent = end;
    this.paginationContainer.querySelector('.total-items').textContent = totalItems;

    // Update button states
    this.paginationContainer.querySelector('.prev-page').disabled = this.currentPage === 1;
    this.paginationContainer.querySelector('.next-page').disabled = this.currentPage >= totalPages;

    // Update page numbers
    this.updatePageNumbers(totalPages);
  }

  updatePageNumbers(totalPages) {
    const pageNumbersContainer = this.paginationContainer.querySelector('.page-numbers');
    pageNumbersContainer.innerHTML = '';

    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
      pageNumbersContainer.appendChild(this.createPageButton(1));
      if (startPage > 2) {
        pageNumbersContainer.appendChild(this.createEllipsis());
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbersContainer.appendChild(this.createPageButton(i));
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbersContainer.appendChild(this.createEllipsis());
      }
      pageNumbersContainer.appendChild(this.createPageButton(totalPages));
    }
  }

  createPageButton(pageNum) {
    const button = document.createElement('button');
    button.className = `page-number ${pageNum === this.currentPage ? 'active' : ''}`;
    button.textContent = pageNum;
    button.addEventListener('click', () => {
      if (pageNum !== this.currentPage) {
        this.currentPage = pageNum;
        this.onPageChange(this.currentPage);
      }
    });
    return button;
  }

  createEllipsis() {
    const span = document.createElement('span');
    span.className = 'page-ellipsis';
    span.textContent = '...';
    return span;
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.onPageChange(this.currentPage);
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.onPageChange(this.currentPage);
    }
  }
  onPageChange(page) {
    if (typeof this.onPageChangeCallback === 'function') {
      this.onPageChangeCallback(page);
    }
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getOffset() {
    return (this.currentPage - 1) * this.itemsPerPage;
  }

  getLimit() {
    return this.itemsPerPage;
  }

  setOnPageChange(callback) {
    if (typeof callback === 'function') {
      this.onPageChangeCallback = callback;
    }
  }
}