function fileTypeManager() {
  return {
    fileTypes: [],
    selectedTypeIndex: -1,
    topDirectories: [],
    loading: false,
    everythingNotFound: false,
    showAddModal: false,
    showEditModal: false,
    showManageModal: false,
    editTypeIndex: -1,
    newType: {
      name: '',
      extensions: '',
      icon: '',
      color: '#333333',
      description: ''
    },
    editType: {
      id: '',
      name: '',
      extensions: '',
      icon: '',
      color: '#333333',
      description: ''
    },
    draggedIndex: null,

    init() {
      console.log('%c fileTypeManager init', 'color:green; background:yellow;');

      // 加载配置
      const config = window.services.loadConfig();
      this.fileTypes = config.fileTypes || [];

      // 默认选中第一个
      if (this.fileTypes.length > 0) {
        this.selectedTypeIndex = 0;
        this.loadDirectories();
      }

      // 监听插件进入
      window.ztools.onPluginEnter(({ payload }) => {
        console.log('%c onPluginEnter payload', 'color:green;', payload);
        this.parsePayload(payload);
      });
    },

    get selectedType() {
      if (this.selectedTypeIndex >= 0 && this.selectedTypeIndex < this.fileTypes.length) {
        return this.fileTypes[this.selectedTypeIndex];
      }
      return null;
    },

    parsePayload(payload) {
      if (!payload) return;

      let keyword = payload.replace(/^filetype\s*/i, '').trim();
      if (!keyword) return;

      // 如果 payload 是扩展名形式（以点开头的），去掉点
      if (keyword.startsWith('.')) {
        keyword = keyword.slice(1);
      }

      if (!keyword) return;

      // 查找匹配的文件类型
      const matchedIndex = this.fileTypes.findIndex(t =>
        t.name === keyword ||
        t.extensions.some(e => e.toLowerCase() === keyword.toLowerCase())
      );

      if (matchedIndex >= 0) {
        this.selectedTypeIndex = matchedIndex;
        this.loadDirectories();
      }
    },

    selectType(index) {
      if (this.selectedTypeIndex === index) return;
      this.selectedTypeIndex = index;
      this.loadDirectories();
    },

    loadDirectories() {
      const type = this.selectedType;
      if (!type) return;

      this.loading = true;
      this.topDirectories = [];
      this.everythingNotFound = false;

      window.services.findTopDirectories(type.extensions).then(dirs => {
        this.topDirectories = dirs;
        this.loading = false;
      }).catch(err => {
        console.error('Scan failed:', err);
        this.loading = false;
        if (err.message && err.message.includes('Everything CLI')) {
          this.everythingNotFound = true;
        }
      });
    },

    deleteType(index) {
      if (confirm('确定要删除这个文件类型吗？')) {
        this.fileTypes.splice(index, 1);
        if (this.selectedTypeIndex >= this.fileTypes.length) {
          this.selectedTypeIndex = this.fileTypes.length - 1;
        }
        this.saveConfig();
        if (this.selectedTypeIndex >= 0) {
          this.loadDirectories();
        }
      }
    },

    addType() {
      const extensions = this.newType.extensions.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
      if (!this.newType.name || extensions.length === 0) {
        alert('请填写名称和扩展名');
        return;
      }

      // 自动生成描述
      const description = this.newType.description || extensions.join(', ').toUpperCase();

      const newType = {
        id: Date.now().toString(),
        name: this.newType.name,
        icon: this.newType.icon || '',
        extensions: extensions,
        color: this.newType.color,
        description: description
      };

      this.fileTypes.push(newType);
      this.saveConfig();
      this.showAddModal = false;
      this.resetNewType();

      // 如果这是第一个类型，自动选中
      if (this.fileTypes.length === 1) {
        this.selectedTypeIndex = 0;
        this.loadDirectories();
      }
    },

    resetNewType() {
      this.newType = {
        name: '',
        extensions: '',
        icon: '',
        color: '#333333',
        description: ''
      };
    },

    openEditModal(index) {
      const type = this.fileTypes[index];
      if (!type) return;

      this.editTypeIndex = index;
      this.editType = {
        id: type.id,
        name: type.name,
        extensions: type.extensions.join(', '),
        icon: type.icon || '',
        color: type.color,
        description: type.description || ''
      };
      this.showEditModal = true;
    },

    openEditModalFromManage(index) {
      this.showManageModal = false;
      this.openEditModal(index);
    },

    deleteTypeFromManage(index) {
      this.deleteType(index);
    },

    saveEditType() {
      if (this.editTypeIndex < 0 || this.editTypeIndex >= this.fileTypes.length) return;

      const extensions = this.editType.extensions.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
      if (!this.editType.name || extensions.length === 0) {
        alert('请填写名称和扩展名');
        return;
      }

      const updatedType = {
        id: this.editType.id,
        name: this.editType.name,
        icon: this.editType.icon || '',
        extensions: extensions,
        color: this.editType.color,
        description: this.editType.description || extensions.join(', ').toUpperCase()
      };

      this.fileTypes[this.editTypeIndex] = updatedType;
      this.saveConfig();
      this.showEditModal = false;

      // 如果编辑的是当前选中的类型，重新加载目录
      if (this.selectedTypeIndex === this.editTypeIndex) {
        this.loadDirectories();
      }
    },

    saveConfig() {
      window.services.saveConfig({ fileTypes: this.fileTypes });
    },

    dragStart(event, index) {
      this.draggedIndex = index;
      event.dataTransfer.effectAllowed = 'move';
      event.target.classList.add('dragging');
    },

    dragOver(event, index) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },

    dragEnd(event) {
      event.target.classList.remove('dragging');
    },

    drop(event, targetIndex) {
      event.preventDefault();
      if (this.draggedIndex === null || this.draggedIndex === targetIndex) {
        this.draggedIndex = null;
        return;
      }

      const draggedItem = this.fileTypes[this.draggedIndex];
      this.fileTypes.splice(this.draggedIndex, 1);
      this.fileTypes.splice(targetIndex, 0, draggedItem);
      this.draggedIndex = null;
      this.saveConfig();

      // 更新选中索引
      if (this.selectedTypeIndex === this.draggedIndex) {
        this.selectedTypeIndex = targetIndex;
      } else if (this.draggedIndex < this.selectedTypeIndex && targetIndex >= this.selectedTypeIndex) {
        this.selectedTypeIndex--;
      } else if (this.draggedIndex > this.selectedTypeIndex && targetIndex <= this.selectedTypeIndex) {
        this.selectedTypeIndex++;
      }
    },

    openDirectory(dirPath) {
      window.services.openDirectory(dirPath);
    },

    createShortcut(dirPath) {
      const type = this.selectedType;
      if (!type) return;
      window.services.createShortcut(dirPath, type.name, type.icon).then(path => {
        alert('快捷方式已创建：' + path);
      }).catch(err => {
        alert('创建快捷方式失败：' + (err.message || err));
      });
    }
  };
}
