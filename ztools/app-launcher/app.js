function appLauncher() {
  return {
    searchResults: [],
    historyResults: [],
    selectedIndex: 0,
    selectedHistoryIndex: 0,
    currentKeyword: '',
    activePanel: 'search',
    searchTimer: null,
    contextMenu: {
      show: false,
      x: 0,
      y: 0,
      index: 0,
      type: '',
      app: null
    },

    init() {
      console.log('%c init', 'color:red; background:yellow;', window.ztools)
      window.ztools.onPluginEnter(({payload}) => {
        console.log('%c payload', 'color:red; background:yellow;', payload)
        this.currentKeyword = payload.replace(/^exel?\s*/i, '').replace(/^app\s*/i, '').trim();

        window.ztools.setSubInput(({text}) => {
          this.currentKeyword = text.trim();

          // 防抖：清除之前的定时器，设置新的定时器
          if (this.searchTimer) {
            clearTimeout(this.searchTimer);
          }

          this.searchTimer = setTimeout(() => {
            this.searchApps(this.currentKeyword);
          }, 500);
        }, '搜索应用');

        setTimeout(() => {
          window.ztools.setSubInputValue(this.currentKeyword);
          this.searchApps(this.currentKeyword);
        }, 100);
      });
    },



    async searchApps(keyword) {
      const trimmedKeyword = keyword.trim();

      try {
        if (trimmedKeyword) {
          this.searchResults = await window.services.searchApps(trimmedKeyword);
          this.historyResults = window.services.getRecentApps();
        } else {
          this.searchResults = [];
          this.historyResults = window.services.getRecentApps();
        }

        this.selectedIndex = 0;
        this.selectedHistoryIndex = 0;
        this.activePanel = this.currentKeyword ? 'search' : 'history';
      } catch (error) {
        console.error('Search failed:', error);
        this.searchResults = [];
        this.historyResults = window.services.getRecentApps();
        this.selectedIndex = 0;
        this.selectedHistoryIndex = 0;
        this.activePanel = 'history';
      }

      // 等待 DOM 更新后滚动
      this.$nextTick(() => {
        if (this.activePanel === 'search' && this.currentKeyword) {
          this.scrollToSelected('listBox', this.selectedIndex);
        } else if (this.activePanel === 'history') {
          this.scrollToSelected('historyList', this.selectedHistoryIndex);
        }
      });
    },

    handleKeyDown(e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (this.currentKeyword && this.searchResults.length > 0 && this.historyResults.length > 0) {
          this.activePanel = this.activePanel === 'search' ? 'history' : 'search';
        }
        return;
      }

      if (this.activePanel === 'search' && this.currentKeyword && this.searchResults.length > 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : this.searchResults.length - 1;
          this.$nextTick(() => this.scrollToSelected('listBox', this.selectedIndex));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedIndex = this.selectedIndex < this.searchResults.length - 1 ? this.selectedIndex + 1 : 0;
          this.$nextTick(() => this.scrollToSelected('listBox', this.selectedIndex));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.launchApp(this.selectedIndex, 'search');
          return;
        }
      }

      if (this.activePanel === 'history' && this.historyResults.length > 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedHistoryIndex = this.selectedHistoryIndex > 0 ? this.selectedHistoryIndex - 1 : this.historyResults.length - 1;
          this.$nextTick(() => this.scrollToSelected('historyList', this.selectedHistoryIndex));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedHistoryIndex = this.selectedHistoryIndex < this.historyResults.length - 1 ? this.selectedHistoryIndex + 1 : 0;
          this.$nextTick(() => this.scrollToSelected('historyList', this.selectedHistoryIndex));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.launchApp(this.selectedHistoryIndex, 'history');
          return;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        window.ztools.outPlugin();
        return;
      }
    },

    showContextMenu(event, index, type) {
      const results = type === 'search' ? this.searchResults : this.historyResults;
      const app = results[index];

      this.contextMenu = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        index: index,
        type: type,
        app: app
      };
    },

    async launchApp(index, type) {
      const results = type === 'search' ? this.searchResults : this.historyResults;
      const app = results[index];
      if (!app) return;

      try {
        await window.services.launchApp(app.path);
        window.ztools.hideMainWindow();
      } catch (error) {
        console.error('Failed to launch app:', error);
        alert('启动应用失败: ' + error.message);
      }
    },

    pinToTop(index, type) {
      if (type === 'search') {
        if (index === 0) return;
        const item = this.searchResults.splice(index, 1)[0];
        this.searchResults.unshift(item);
        this.selectedIndex = 0;
      } else {
        if (index === 0) return;
        const item = this.historyResults.splice(index, 1)[0];
        this.historyResults.unshift(item);
        this.selectedHistoryIndex = 0;
        window.services.updateHistoryOrder(this.historyResults);
      }
      this.contextMenu.show = false;
    },

    openFileLocation(filePath) {
      window.services.openFileLocation(filePath);
      this.contextMenu.show = false;
    },

    copyPath(filePath) {
      navigator.clipboard.writeText(filePath).then(() => {
        // Path copied successfully
      });
      this.contextMenu.show = false;
    },

    deleteFromHistory(index, type) {
      if (type === 'history') {
        const app = this.historyResults[index];
        window.services.deleteFromHistory(app.path);
        this.historyResults.splice(index, 1);
        this.selectedHistoryIndex = Math.min(this.selectedHistoryIndex, this.historyResults.length - 1);
      }
      this.contextMenu.show = false;
    },

    scrollToSelected(containerId, index) {
      const container = document.getElementById(containerId);
      if (!container) return;

      // 使用 data-index 属性查找选中的元素
      const selectedItem = container.querySelector(`[data-index="${index}"]`);
      if (!selectedItem) return;

      const containerRect = container.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();

      if (itemRect.top < containerRect.top) {
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (itemRect.bottom > containerRect.bottom) {
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  };
}
