/**
 * @typedef {object} SearchResultData
 * @property {string} url
 * @property {string} excerpt
 * @property {Record<string, string | undefined>} meta
 * @property {Record<string, string[] | undefined>} [filters]
 *
 * @typedef {object} SearchApi
 * @property {(term: string) => Promise<{results: {data(): Promise<SearchResultData>}[]}>} search
 *
 * @typedef {object} SearchState
 * @property {'idle' | 'loading' | 'ready' | 'error'} phase
 * @property {string} query
 * @property {SearchResultData[]} items
 * @property {number} total
 */

/**
 * 共享索引加载，但只允许最近一次查询更新页面。失败后可以重新加载或搜索。
 * @param {object} options
 * @param {() => Promise<SearchApi>} options.loadApi
 * @param {(state: SearchState) => void} options.onState
 * @param {(error: unknown) => void} [options.onError]
 * @param {number} [options.maxResults]
 */
export function createSearchController({ loadApi, onState, onError, maxResults = 20 }) {
  /** @type {SearchApi | undefined} */
  let api;
  /** @type {Promise<SearchApi> | undefined} */
  let loading;
  let version = 0;

  async function getApi() {
    if (api) return api;
    if (!loading) {
      loading = Promise.resolve()
        .then(loadApi)
        .then((loaded) => {
          api = loaded;
          return loaded;
        })
        .finally(() => {
          loading = undefined;
        });
    }
    return loading;
  }

  return {
    // 输入变化时立即作废旧查询，避免防抖等待期间渲染过期结果。
    cancel() {
      version += 1;
    },

    /** @param {string} term */
    async run(term) {
      const current = ++version;
      const query = term.trim();
      const empty = { query, items: [], total: 0 };
      if (!query) {
        onState({ ...empty, phase: 'idle' });
        return;
      }

      onState({ ...empty, phase: 'loading' });
      try {
        const pagefind = await getApi();
        if (current !== version) return;
        const search = await pagefind.search(query);
        if (current !== version) return;
        const items = await Promise.all(
          search.results.slice(0, maxResults).map((result) => result.data()),
        );
        if (current !== version) return;
        onState({ phase: 'ready', query, items, total: search.results.length });
      } catch (error) {
        if (current !== version) return;
        onState({ ...empty, phase: 'error' });
        onError?.(error);
      }
    },
  };
}
