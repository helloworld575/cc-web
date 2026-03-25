export type Locale = 'en' | 'zh';

export const translations = {
  en: {
    // Nav
    home: 'Home',
    blog: 'Blog',
    tools: 'Tools',
    files: 'Files',
    admin: 'Admin',
    login: 'Login',
    logout: 'Logout',

    // Home
    homeTitle: "ThomasLee's Blog",
    homeDesc: 'Tech, tools, and thoughts — welcome to my corner of the internet.',

    // Blog
    blogTitle: 'Blog',
    searchPlaceholder: 'Search...',
    noPosts: 'No posts found.',
    readMore: 'Read more',
    loading: 'Loading...',
    postNotFound: 'Post not found.',

    // Tools / Todos
    toolsTitle: 'Todos',
    newTodoPlaceholder: 'New todo...',
    add: 'Add',
    all: 'All',
    pending: 'Pending',
    done: 'Done',
    noTodos: 'No todos yet.',

    // Files
    filesTitle: 'Files',
    uploadHint: 'Click or drag & drop images here (multiple supported)',
    uploading: 'Uploading...',

    // Login
    loginTitle: 'Login',
    passwordPlaceholder: 'Password',
    loginBtn: 'Login',
    loginError: 'Invalid password',

    // Blog post
    backToBlog: '← Back to Blog',
    publishedOn: 'Published on',

    // Pagination
    prev: 'Prev',
    next: 'Next',

    // Date filter
    dateFrom: 'From',
    dateTo: 'To',
    dateReset: 'Clear',
    diary: 'Diary',
    bazi: 'Fortune',

    // Deadline
    deadline: 'Deadline',
    deadlinePlaceholder: 'Set deadline (optional)',
    deadlineOverdue: 'Overdue',
    deadlineToday: 'Due today',
    deadlineTomorrow: 'Due tomorrow',
    deadlineSoon: 'Due soon',
    deadlineAlertTitle: 'Upcoming Deadlines',

    // Admin — shared
    edit: 'Edit',
    view: 'View',
    delete: 'Delete',
    del: 'Del',
    save: 'Save',
    saved: 'Saved!',
    search: 'Search',

    // Admin — blog list
    adminBlog: 'Blog Posts',
    newPostPlaceholder: 'New post title…',
    newPost: '+ New',
    colTitle: 'Title',
    colDate: 'Date',
    colActions: 'Actions',

    // Admin — blog editor
    briefPlaceholder: 'Brief / excerpt (shown on blog list page)',
    aiTools: 'AI Tools',
    appendToArticle: 'Append to article',
    clickToApplyTitle: 'Click to apply title:',
    clickToCopyTag: 'Click to copy tag:',
    writeContentFirst: 'Write some content first',

    // Admin — files
    adminFiles: 'Admin — Files',

    // Admin — todos
    adminTodos: 'Admin — Todos',
    newTodo: 'New todo',

    // Markdown editor
    write: 'Write',
    preview: 'Preview',
    markdownPlaceholder: 'Write markdown here...',

    // Fortune history
    fortuneHistory: 'History',
    fortuneReading: 'Reading',
    fortuneNoHistory: 'No readings yet.',
    fortuneDeleteConfirm: 'Delete this reading?',
    fortuneDeleted: 'Deleted',
    fortuneSaved: 'Saved to history',
    fortuneViewFull: 'View full analysis',
    fortuneBack: 'Back to list',
  },
  zh: {
    // Nav
    home: '首页',
    blog: '博客',
    tools: '工具',
    files: '文件',
    admin: '管理',
    login: '登录',
    logout: '退出',

    // Home
    homeTitle: 'ThomasLee 的博客',
    homeDesc: '技术、工具与随想 — 欢迎来到我的小站。',

    // Blog
    blogTitle: '博客',
    searchPlaceholder: '搜索...',
    noPosts: '没有找到文章。',
    readMore: '阅读更多',
    loading: '加载中...',
    postNotFound: '文章不存在。',

    // Tools / Todos
    toolsTitle: '待办事项',
    newTodoPlaceholder: '新建待办...',
    add: '添加',
    all: '全部',
    pending: '待完成',
    done: '已完成',
    noTodos: '暂无待办。',

    // Files
    filesTitle: '文件',
    uploadHint: '点击或拖放图片到此处（支持多选）',
    uploading: '上传中...',

    // Login
    loginTitle: '登录',
    passwordPlaceholder: '密码',
    loginBtn: '登录',
    loginError: '密码错误',

    // Blog post
    backToBlog: '← 返回博客',
    publishedOn: '发布于',

    // Pagination
    prev: '上一页',
    next: '下一页',

    // Date filter
    dateFrom: '从',
    dateTo: '到',
    dateReset: '清除',
    diary: '日记',
    bazi: '算命',

    // Deadline
    deadline: '截止日期',
    deadlinePlaceholder: '设置截止日期（可选）',
    deadlineOverdue: '已逾期',
    deadlineToday: '今天到期',
    deadlineTomorrow: '明天到期',
    deadlineSoon: '即将到期',
    deadlineAlertTitle: '即将到期的任务',

    // Admin — shared
    edit: '编辑',
    view: '查看',
    delete: '删除',
    del: '删',
    save: '保存',
    saved: '已保存！',
    search: '搜索',

    // Admin — blog list
    adminBlog: '博客文章',
    newPostPlaceholder: '新文章标题…',
    newPost: '+ 新建',
    colTitle: '标题',
    colDate: '日期',
    colActions: '操作',

    // Admin — blog editor
    briefPlaceholder: '摘要 / 简介（显示在博客列表页）',
    aiTools: 'AI 工具',
    appendToArticle: '追加到文章末尾',
    clickToApplyTitle: '点击应用标题：',
    clickToCopyTag: '点击复制标签：',
    writeContentFirst: '请先写一些内容',

    // Admin — files
    adminFiles: '管理 — 文件',

    // Admin — todos
    adminTodos: '管理 — 待办事项',
    newTodo: '新建待办',

    // Markdown editor
    write: '编写',
    preview: '预览',
    markdownPlaceholder: '在此写 Markdown...',

    // Fortune history
    fortuneHistory: '历史记录',
    fortuneReading: '解读',
    fortuneNoHistory: '暂无记录。',
    fortuneDeleteConfirm: '确定删除此记录？',
    fortuneDeleted: '已删除',
    fortuneSaved: '已保存到历史',
    fortuneViewFull: '查看完整分析',
    fortuneBack: '返回列表',
  },
} satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof typeof translations.en;
