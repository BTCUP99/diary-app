// 日记本应用主逻辑
const DB_NAME = 'DiaryAppDB';
const STORE_NAME = 'diaries';
const DB_VERSION = 1;

// 数据库实例
let db = null;
let currentView = 'home';
let currentYear = new Date().getFullYear();
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();
let selectedMood = 'normal';
let editingDiaryId = null;

// 工具函数
const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDisplayDate = (dateStr) => {
  const d = new Date(dateStr);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
};

const getToday = () => formatDate(new Date());

const getChineseWeekday = (date) => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[new Date(date).getDay()];
};

// 数据库操作
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };
  });
};

const getAllDiaries = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveDiary = (diary) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(diary);

    request.onsuccess = () => resolve(diary);
    request.onerror = () => reject(request.error);
  });
};

const deleteDiary = (id) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getDiaryByDate = (date) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('date');
    const request = index.getAll(date);

    request.onsuccess = () => {
      const results = request.result;
      resolve(results.length > 0 ? results[0] : null);
    };
    request.onerror = () => reject(request.error);
  });
};

// 渲染热力图
const renderHeatmap = (year) => {
  const grid = document.getElementById('heatmap-grid');
  const monthsEl = document.getElementById('heatmap-months');

  grid.innerHTML = '';
  monthsEl.innerHTML = '';

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // 找到第一个周日的日期
  let currentDate = new Date(startDate);
  while (currentDate.getDay() !== 0) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  // 生成月份标签
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月',
                      '7月', '8月', '9月', '10月', '11月', '12月'];
  let currentMonth = -1;
  let weekIndex = 0;

  // 生成周列
  while (currentDate <= endDate || currentDate.getDay() !== 0) {
    const week = document.createElement('div');
    week.className = 'heatmap-week';

    for (let day = 0; day < 7; day++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'heatmap-day';

      const dateStr = formatDate(currentDate);
      const isInYear = currentDate.getFullYear() === year;
      const isToday = dateStr === getToday();

      // 计算等级（字数分段）
      let level = 0;
      if (isInYear && diaryMap.has(dateStr)) {
        const diary = diaryMap.get(dateStr);
        const length = diary.content ? diary.content.length : 0;
        if (length > 0 && length <= 50) level = 1;
        else if (length <= 150) level = 2;
        else if (length <= 300) level = 3;
        else level = 4;
      }

      if (isInYear) {
        dayEl.classList.add(`level-${level}`);
        if (isToday) dayEl.classList.add('today');

        // 添加点击事件
        dayEl.addEventListener('click', () => openDiaryModal(dateStr));

        // 添加提示
        dayEl.title = `${dateStr} ${getChineseWeekday(dateStr)}`;
      } else {
        dayEl.classList.add('level-0');
        dayEl.style.opacity = '0.3';
      }

      week.appendChild(dayEl);

      // 月份标签
      if (isInYear && currentDate.getMonth() !== currentMonth) {
        currentMonth = currentDate.getMonth();
        const monthLabel = document.createElement('span');
        monthLabel.textContent = monthNames[currentMonth];
        monthsEl.appendChild(monthLabel);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    grid.appendChild(week);
    weekIndex++;
  }

  document.getElementById('current-year').textContent = year;
};

// 日历视图渲染
const renderCalendar = () => {
  const container = document.getElementById('calendar-days');
  container.innerHTML = '';

  const firstDay = new Date(currentCalYear, currentCalMonth, 1);
  const lastDay = new Date(currentCalYear, currentCalMonth + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  document.getElementById('cal-current-month').textContent =
    `${currentCalYear}年${currentCalMonth + 1}月`;

  // 添加空格子
  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    container.appendChild(empty);
  }

  // 添加日期
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentCalYear}-${String(currentCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;

    if (diaryMap.has(dateStr)) {
      dayEl.classList.add('has-diary');
    }

    const today = getToday();
    if (dateStr === today) {
      dayEl.classList.add('today');
    }

    dayEl.addEventListener('click', () => openDiaryModal(dateStr));
    container.appendChild(dayEl);
  }
};

// 日记列表渲染
const renderDiaryList = (sort = 'newest') => {
  const container = document.getElementById('diary-list');
  const diaries = Array.from(diaryMap.values());

  if (diaries.length === 0) {
    container.innerHTML = '<p class="empty-message">暂无日记，写下你的第一篇日记吧！</p>';
    return;
  }

  // 排序
  diaries.sort((a, b) => {
    if (sort === 'newest') return new Date(b.date) - new Date(a.date);
    return new Date(a.date) - new Date(b.date);
  });

  container.innerHTML = diaries.map(diary => `
    <div class="diary-item" data-id="${diary.id}">
      <div class="diary-item-header">
        <span class="diary-item-date">${formatDisplayDate(diary.date)}</span>
        <span class="diary-item-mood">${getMoodEmoji(diary.mood)}</span>
      </div>
      ${diary.title ? `<div class="diary-item-title">${diary.title}</div>` : ''}
      <div class="diary-item-preview">${diary.content || '无内容'}</div>
    </div>
  `).join('');

  // 添加点击事件
  container.querySelectorAll('.diary-item').forEach(item => {
    item.addEventListener('click', () => {
      const diary = diaryMap.get(item.dataset.id);
      if (diary) openDiaryModal(diary.date, diary.id);
    });
  });
};

// 搜索功能
const searchDiaries = (keyword) => {
  const results = [];
  const kw = keyword.toLowerCase().trim();

  if (!kw) return results;

  diaryMap.forEach(diary => {
    const title = (diary.title || '').toLowerCase();
    const content = (diary.content || '').toLowerCase();
    if (title.includes(kw) || content.includes(kw)) {
      results.push(diary);
    }
  });

  return results;
};

const renderSearchResults = (results) => {
  const container = document.getElementById('search-results');

  if (results.length === 0) {
    container.innerHTML = '<p class="empty-message">没有找到匹配的日记</p>';
    return;
  }

  container.innerHTML = results.map(diary => `
    <div class="diary-item" data-id="${diary.id}">
      <div class="diary-item-header">
        <span class="diary-item-date">${formatDisplayDate(diary.date)}</span>
        <span class="diary-item-mood">${getMoodEmoji(diary.mood)}</span>
      </div>
      ${diary.title ? `<div class="diary-item-title">${diary.title}</div>` : ''}
      <div class="diary-item-preview">${diary.content || '无内容'}</div>
    </div>
  `).join('');

  container.querySelectorAll('.diary-item').forEach(item => {
    item.addEventListener('click', () => {
      const diary = diaryMap.get(item.dataset.id);
      if (diary) {
        switchView('home');
        openDiaryModal(diary.date, diary.id);
      }
    });
  });
};

// 心情相关
const getMoodEmoji = (mood) => {
  const moods = {
    happy: '😊',
    normal: '😐',
    sad: '😢',
    angry: '😠',
    excited: '🤩'
  };
  return moods[mood] || '😐';
};

// 更新统计
const updateStats = () => {
  const count = diaryMap.size;
  document.getElementById('total-diary-count').textContent = count;

  // 计算连续天数
  let streak = 0;
  const today = new Date();
  const current = new Date(today);

  while (true) {
    const dateStr = formatDate(current);
    if (diaryMap.has(dateStr)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  document.getElementById('current-streak').textContent = streak;
};

// 更新今日日记显示
const updateTodayDiary = () => {
  const today = getToday();
  const todayEl = document.getElementById('today-date');
  const contentEl = document.getElementById('today-content');

  todayEl.textContent = `今天是 ${formatDisplayDate(today)}`;

  if (diaryMap.has(today)) {
    const diary = diaryMap.get(today);
    const title = diary.title ? `<strong>${diary.title}</strong>\n\n` : '';
    const mood = getMoodEmoji(diary.mood);
    contentEl.innerHTML = `<span class="diary-mood">${mood}</span>\n${title}${diary.content}`;
  } else {
    contentEl.innerHTML = '<p class="no-diary">今天还没有写日记哦～</p>';
  }
};

// 视图切换
const switchView = (view) => {
  currentView = view;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById(`${view}-view`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`).classList.add('active');

  // 刷新视图内容
  if (view === 'home') {
    renderHeatmap(currentYear);
    updateTodayDiary();
  } else if (view === 'calendar') {
    renderCalendar();
  } else if (view === 'list') {
    renderDiaryList(document.getElementById('list-sort').value);
  }
};

// 模态框操作
const openDiaryModal = async (date, diaryId = null) => {
  const modal = document.getElementById('diary-modal');
  const titleEl = document.getElementById('modal-title');
  const dateEl = document.getElementById('diary-date');
  const titleInput = document.getElementById('diary-title');
  const contentEl = document.getElementById('diary-text');
  const deleteBtn = document.getElementById('delete-diary-btn');

  editingDiaryId = diaryId;

  if (diaryId && diaryMap.has(diaryId)) {
    const diary = diaryMap.get(diaryId);
    titleEl.textContent = '编辑日记';
    dateEl.value = diary.date;
    titleInput.value = diary.title || '';
    contentEl.value = diary.content || '';
    selectedMood = diary.mood || 'normal';
    deleteBtn.style.display = 'block';
  } else {
    titleEl.textContent = '写日记';
    dateEl.value = date;
    titleInput.value = '';
    contentEl.value = '';
    selectedMood = 'normal';
    deleteBtn.style.display = 'none';
  }

  // 更新心情按钮状态
  updateMoodButtons();
  modal.classList.add('active');
};

const closeDiaryModal = () => {
  document.getElementById('diary-modal').classList.remove('active');
  editingDiaryId = null;
};

const updateMoodButtons = () => {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    if (btn.dataset.mood === selectedMood) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
};

const handleSaveDiary = async () => {
  const date = document.getElementById('diary-date').value;
  const title = document.getElementById('diary-title').value.trim();
  const content = document.getElementById('diary-text').value.trim();

  if (!content) {
    alert('请输入日记内容');
    return;
  }

  const diary = {
    id: editingDiaryId || `${date}_${Date.now()}`,
    date,
    title,
    content,
    mood: selectedMood,
    updatedAt: Date.now()
  };

  await saveDiary(diary);
  diaryMap.set(diary.id, diary);

  closeDiaryModal();
  refreshAllViews();
};

const handleDeleteDiary = async () => {
  if (!editingDiaryId) return;

  if (!confirm('确定要删除这篇日记吗？')) return;

  await deleteDiary(editingDiaryId);
  diaryMap.delete(editingDiaryId);

  closeDiaryModal();
  refreshAllViews();
};

// 全局数据
let diaryMap = new Map();

const refreshAllViews = async () => {
  // 重新加载数据
  const diaries = await getAllDiaries();
  diaryMap.clear();
  diaries.forEach(d => diaryMap.set(d.id, d));

  // 刷新各视图
  if (currentView === 'home') {
    renderHeatmap(currentYear);
    updateTodayDiary();
  } else if (currentView === 'calendar') {
    renderCalendar();
  } else if (currentView === 'list') {
    renderDiaryList(document.getElementById('list-sort').value);
  }

  updateStats();
};

// 初始化
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await openDB();
    await refreshAllViews();

    // 视图切换
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // 年度导航
    document.getElementById('prev-year').addEventListener('click', () => {
      currentYear--;
      renderHeatmap(currentYear);
    });

    document.getElementById('next-year').addEventListener('click', () => {
      if (currentYear < new Date().getFullYear()) {
        currentYear++;
        renderHeatmap(currentYear);
      }
    });

    // 日历导航
    document.getElementById('cal-prev-month').addEventListener('click', () => {
      currentCalMonth--;
      if (currentCalMonth < 0) {
        currentCalMonth = 11;
        currentCalYear--;
      }
      renderCalendar();
    });

    document.getElementById('cal-next-month').addEventListener('click', () => {
      const now = new Date();
      if (currentCalYear < now.getFullYear() ||
          (currentCalYear === now.getFullYear() && currentCalMonth < now.getMonth())) {
        currentCalMonth++;
        if (currentCalMonth > 11) {
          currentCalMonth = 0;
          currentCalYear++;
        }
        renderCalendar();
      }
    });

    // 列表排序
    document.getElementById('list-sort').addEventListener('change', (e) => {
      renderDiaryList(e.target.value);
    });

    // 搜索
    document.getElementById('search-btn').addEventListener('click', () => {
      const keyword = document.getElementById('search-input').value;
      const results = searchDiaries(keyword);
      renderSearchResults(results);
    });

    document.getElementById('search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('search-btn').click();
      }
    });

    // 今日日记按钮
    document.getElementById('write-today-btn').addEventListener('click', () => {
      openDiaryModal(getToday());
    });

    // 模态框
    document.getElementById('modal-close').addEventListener('click', closeDiaryModal);
    document.getElementById('save-diary-btn').addEventListener('click', handleSaveDiary);
    document.getElementById('delete-diary-btn').addEventListener('click', handleDeleteDiary);

    // 心情选择
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMood = btn.dataset.mood;
        updateMoodButtons();
      });
    });

    // 点击模态框外部关闭
    document.getElementById('diary-modal').addEventListener('click', (e) => {
      if (e.target.id === 'diary-modal') closeDiaryModal();
    });

    // 初始显示
    switchView('home');

  } catch (error) {
    console.error('初始化失败:', error);
    alert('应用初始化失败，请刷新页面重试');
  }
});
