import { Collection } from "../support/Collection";

/**
 * Paginator class for paginating query results
 */
export class Paginator<T = any> {
  protected items: Collection<T>;
  protected total: number;
  protected perPage: number;
  protected currentPage: number;
  protected lastPage: number;
  protected from: number;
  protected to: number;

  constructor(
    items: T[],
    total: number,
    perPage: number,
    currentPage: number = 1
  ) {
    this.items = new Collection(items);
    this.total = total;
    this.perPage = perPage;
    this.currentPage = currentPage;
    this.lastPage = Math.max(Math.ceil(total / perPage), 1);
    
    // Calculate from and to
    if (items.length > 0) {
      this.from = (currentPage - 1) * perPage + 1;
      this.to = Math.min(this.from + items.length - 1, total);
    } else {
      this.from = 0;
      this.to = 0;
    }
  }

  /**
   * Get the collection of items
   */
  public data(): Collection<T> {
    return this.items;
  }

  /**
   * Get total number of items
   */
  public getTotal(): number {
    return this.total;
  }

  /**
   * Get number of items per page
   */
  public getPerPage(): number {
    return this.perPage;
  }

  /**
   * Get current page number
   */
  public getCurrentPage(): number {
    return this.currentPage;
  }

  /**
   * Get last page number
   */
  public getLastPage(): number {
    return this.lastPage;
  }

  /**
   * Get the index of the first item on the current page
   */
  public getFrom(): number {
    return this.from;
  }

  /**
   * Get the index of the last item on the current page
   */
  public getTo(): number {
    return this.to;
  }

  /**
   * Check if there is a next page
   */
  public hasMorePages(): boolean {
    return this.currentPage < this.lastPage;
  }

  /**
   * Check if there is a previous page
   */
  public hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  /**
   * Get next page number or null
   */
  public nextPage(): number | null {
    return this.hasMorePages() ? this.currentPage + 1 : null;
  }

  /**
   * Get previous page number or null
   */
  public previousPage(): number | null {
    return this.hasPreviousPage() ? this.currentPage - 1 : null;
  }

  /**
   * Check if on first page
   */
  public onFirstPage(): boolean {
    return this.currentPage === 1;
  }

  /**
   * Check if on last page
   */
  public onLastPage(): boolean {
    return this.currentPage === this.lastPage;
  }

  /**
   * Get number of items in current page
   */
  public count(): number {
    return this.items.count();
  }

  /**
   * Check if paginator is empty
   */
  public isEmpty(): boolean {
    return this.items.isEmpty();
  }

  /**
   * Check if paginator is not empty
   */
  public isNotEmpty(): boolean {
    return this.items.isNotEmpty();
  }

  /**
   * Get page range for pagination links
   * @param onEachSide Number of pages to show on each side of current page
   */
  public getPageRange(onEachSide: number = 3): number[] {
    const pages: number[] = [];
    
    let start = Math.max(1, this.currentPage - onEachSide);
    let end = Math.min(this.lastPage, this.currentPage + onEachSide);
    
    // Adjust if we're near the beginning
    if (this.currentPage <= onEachSide) {
      end = Math.min(this.lastPage, onEachSide * 2 + 1);
    }
    
    // Adjust if we're near the end
    if (this.currentPage > this.lastPage - onEachSide) {
      start = Math.max(1, this.lastPage - onEachSide * 2);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  /**
   * Generate pagination links data
   * @param url Base URL for pagination links
   */
  public links(url: string = ""): PaginationLink[] {
    const links: PaginationLink[] = [];
    
    // Previous page link
    links.push({
      label: "Previous",
      page: this.previousPage(),
      url: this.previousPage() ? `${url}?page=${this.previousPage()}` : null,
      active: false,
    });
    
    // Page number links
    const pageRange = this.getPageRange();
    
    for (let i = 1; i <= this.lastPage; i++) {
      if (pageRange.includes(i)) {
        links.push({
          label: i.toString(),
          page: i,
          url: `${url}?page=${i}`,
          active: i === this.currentPage,
        });
      } else if (i === 1 || i === this.lastPage) {
        // Always show first and last page
        links.push({
          label: i.toString(),
          page: i,
          url: `${url}?page=${i}`,
          active: i === this.currentPage,
        });
      } else if (
        pageRange.length > 0 &&
        ((i < pageRange[0]! && i > 1) ||
        (i > pageRange[pageRange.length - 1]! && i < this.lastPage))
      ) {
        // Add ellipsis (avoid duplicates)
        const lastLink = links[links.length - 1];
        if (!lastLink || lastLink.label !== "...") {
          links.push({
            label: "...",
            page: null,
            url: null,
            active: false,
          });
        }
      }
    }
    
    // Next page link
    links.push({
      label: "Next",
      page: this.nextPage(),
      url: this.nextPage() ? `${url}?page=${this.nextPage()}` : null,
      active: false,
    });
    
    return links;
  }

  /**
   * Convert paginator to array for API responses
   */
  public toArray(): Record<string, any> {
    return {
      data: this.items.toArray(),
      current_page: this.currentPage,
      per_page: this.perPage,
      total: this.total,
      last_page: this.lastPage,
      from: this.from,
      to: this.to,
      first_page: 1,
      prev_page: this.previousPage(),
      next_page: this.nextPage(),
    };
  }

  /**
   * Convert paginator to JSON string
   */
  public toJSON(): string {
    return JSON.stringify(this.toArray());
  }
}

/**
 * Pagination link interface
 */
export interface PaginationLink {
  label: string;
  page: number | null;
  url: string | null;
  active: boolean;
}
