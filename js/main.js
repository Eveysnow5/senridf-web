/* ============================================================
   千里同風株式会社 — Main JavaScript
   i18n | Navigation | Scroll Animations
   ============================================================ */

/* === TRANSLATION DATA === */
const T = {
  ja: {
    /* Navigation */
    nav_about: '私たちについて',
    nav_team: 'チーム',
    nav_milestones: '沿革',
    nav_solutions: 'ソリューション',
    nav_products: '製品',
    nav_demo: 'オンラインデモ',
    nav_blog: 'ブログ',

    /* Hero */
    hero_corp: '千里同風株式会社',
    hero_tagline: '人間がAIとの寄り添いを求めるすべての願いは、魂の共鳴への渇望にほかならない。',
    hero_scroll: 'scroll',

    /* Mission */
    mission_eyebrow: 'ミッション',
    mission_title: 'AIとハードウェアの融合を通じて、人と技術の距離を縮める。',
    mission_body:
      '私たちは、生成AIをハードウェアに組み込むことで、温かみと知性を持つ製品を生み出します。技術は人間のためにある——その信念のもと、日本市場に向けたプロダクト企画・開発を行っています。',

    /* Vision */
    vision_eyebrow: 'ビジョン',
    vision_title: '温かみのあるAIが、人々の日常に静かに溶け込む世界を創る。',
    vision_body:
      'おもちゃ、教具、IoTデバイスを通じて、人とAIの新しい関係性を探求する。それが私たちの目指す未来です。',

    /* Values */
    values_eyebrow: '価値観',
    values_title: '技術は人間のために',
    val1_name: 'リアリズム',
    val1_desc: '現実に根ざした企画と実行。理想を掲げながらも、実現可能な道筋を誠実に追い求めます。',
    val2_name: '明確さ',
    val2_desc:
      '複雑な技術を、誰もが理解できる言葉と形に変える。明確なコミュニケーションが信頼の土台です。',
    val3_name: '責任',
    val3_desc:
      'テクノロジーの力を持つ者が、その使い方に責任を持つ。私たちはAIの倫理的活用にコミットします。',

    /* About teaser (homepage) */
    about_teaser_eyebrow: '千里同風とは',
    about_teaser_title: '大阪から、AIと人をつなぐ新しい形を探して。',
    about_teaser_body:
      '千里同風株式会社は、生成AI搭載ハードウェアの研究・企画に特化した会社です。市場調査から製品コンセプト開発まで、一貫したサポートを提供します。',
    about_teaser_cta: 'チームを見る',

    nav_member: 'メンバー',
    demo_tools_eyebrow: 'オンラインツール',
    demo_tools_title: '会員専用ツール',
    demo_tools_body: 'ログイン後にご利用いただけます。',
    demo_member_badge: '会員限定',

    /* Footer */
    footer_tagline: '人間がAIとの寄り添いを求めるすべての願いは、魂の共鳴への渇望にほかならない。',
    footer_nav_heading: 'ナビゲーション',
    footer_contact_heading: 'お問い合わせ',
    footer_copy: '© 2024 千里同風株式会社',
    addr_street: '大阪府大阪市淀川区西三国4丁目4-9-7',
    addr_city: '大阪市, 日本',

    /* Team page */
    team_page_title: '千里同風株式会社 — チーム',
    team_eyebrow: 'チーム',
    team_title: '私たちのチーム',
    team_body: '少数精鋭で、AIとハードウェアの未来を切り拓いています。',
    team1_role: '代表取締役',
    team1_bio:
      '千里同風株式会社の代表。生成AIを活用したハードウェア製品の事業開発・市場開拓を主導。日本市場向けのAI製品企画・サプライチェーン構築に注力しています。',
    team2_role: 'ビジネスアドバイザー',
    team2_bio:
      '中国公認会計士（CPA）。財務戦略・クロスボーダービジネスのアドバイザリーを担当。中日間のビジネス開発および財務管理をサポートします。',

    /* Milestones page */
    milestones_page_title: '千里同風株式会社 — 沿革',
    milestones_eyebrow: '沿革',
    milestones_title: '会社の歩み',
    milestones_body: '千里同風株式会社の設立から現在までの歩みをご覧ください。',
    ms1_event: '千里同風株式会社 設立',
    ms1_desc: '大阪市にて設立。生成AI搭載ハードウェアの研究・企画に特化した会社として始動。',
    ms2_event: '市場調査・製品企画 開始',
    ms2_desc:
      '日本市場向け生成AIハードウェア製品の調査・コンセプト開発を開始。教育・医療・家電・公共サービス分野での可能性を探求。',
    ms3_event: '公式ウェブサイト 公開',
    ms3_desc:
      '千里同風株式会社の公式ウェブサイトをリニューアルし、会社のビジョンとサービスを世界に向けて発信。',

    /* Solutions page */
    solutions_page_title: '千里同風株式会社 — ソリューション',
    solutions_eyebrow: 'ソリューション',
    solutions_title: '製品・サービス',
    solutions_body:
      '生成AIとハードウェアを融合させた、新しいカテゴリの製品群。教育・IoT・エンターテインメント分野で、人とAIの新しい関係性を提案します。',
    services_eyebrow: 'サービス',
    services_title: '私たちが提供すること',
    srv1_name: '市場・業界調査',
    srv1_desc:
      'クロスボーダー分析、競合評価、ユーザーインサイト。日本市場の深い理解に基づいた調査を提供します。',
    srv2_name: '製品企画・市場参入支援',
    srv2_desc:
      'サプライチェーン調査、ユーザースタディ、コンセプト開発、パートナーシップ促進まで、一貫してサポートします。',
    srv3_name: 'AI統合ハードウェア開発',
    srv3_desc:
      '生成AI・画像認識・音声インターフェースを組み込んだハードウェア製品の企画・プロトタイピング支援。',
    coming_soon: '近日公開',
    product1_category: '教育向け',
    product1_name: 'AI学習デバイス',
    product1_desc:
      '生成AI技術を搭載した子ども向け学習デバイス。インタラクティブな対話を通じて学びを深めます。',
    product2_category: 'IoT',
    product2_name: '画像認識 IoTデバイス',
    product2_desc:
      '高精度な画像認識機能を搭載したスマートIoTデバイス。環境を理解し、適切に反応します。',
    product3_category: 'エンターテインメント',
    product3_name: 'AIインタラクティブ トイ',
    product3_desc: '生成AIと連携した次世代インタラクティブトイ。子どもの創造性と感性を育みます。',

    /* Demo page */
    demo_page_title: '千里同風株式会社 — オンラインデモ',
    demo_eyebrow: 'オンラインデモ',
    demo_title: '機能を体験する',
    demo_intro: '開発中の機能をブラウザ上でご体験いただけます。各デモは随時アップデートされます。',
    demo1_title: '画像認識デモ',
    demo1_desc: 'カメラで撮影した画像、または画像ファイルをAIがリアルタイムで分析・識別します。',
    demo3_title: '音声インターフェース デモ',
    demo3_desc: '音声コマンドでデバイスを操作するインターフェースのデモです。',
    demo4_title: '感情認識 デモ',
    demo4_desc: '表情や音声から感情を認識するAIモデルのデモです。',
    demo_coming: '近日公開',

    analysis_title: '文書分析 · 比較レポート',
    analysis_desc:
      '複数のPDF・Word・Excelをアップロードし、AIが内容を横断分析してレポートを生成。事業モデルの比較・調査分析に。',
    analysis_cta: '分析ツールを開く',

    lifestory_title: '生平故事 · 人生インタビュー',
    lifestory_desc:
      '約100問のインタビューに答えると、AIがあなたの生涯を一冊の物語に。毎回数問ずつ、約一ヶ月で完成。',
    lifestory_cta: '記録を始める',

    japanese_title: '日本語基礎学習ツール',
    japanese_desc:
      '214語の常用動詞を内蔵。五段・一段・不規則動詞の活用を自動生成し、中英双解付き。一覧・フラッシュカード・小テストの3モード対応。',
    japanese_cta: '学習を始める',

    proofreader_label: 'Live · 会員限定',
    proofreader_title: '中国語原稿 校正アシスタント',
    proofreader_desc:
      'Wordをアップロードまたはテキストを貼り付けると、誤字・重複文・編集指示の残留・前後の論理矛盾を自動チェックし、分類された校正レポートを出力します。',
    proofreader_cta: '校正を始める',

    bids_label: 'Internal · 会員限定',
    bids_title: '大阪市 入札情報モニタリング',
    bids_desc:
      '大阪市が公表する業務委託・物品供給の入札公告を毎日自動取得し、中国語要約を提供。小規模事業者向けの案件を素早く絞り込めます。',
    bids_cta: '入札情報を見る',

    cat_translation: '翻訳',
    cat_analysis: '分析',
    cat_story: '記録',
    cat_learning: '学習',
    demo_label_frontend: 'Live · 純フロントエンド',

    /* Blog page */
    blog_page_title: '千里同風株式会社 — ブログ',
    blog_eyebrow: 'ブログ',
    blog_title: 'インサイト',
    blog_intro: 'AI・ハードウェア・日本市場に関する考察と発見を書き留めています。',
    blog_empty: '記事は近日公開予定です。',

    /* Translation tool */
    tl_page_title: '千里同風 — 中日翻訳・音声通訳ツール',
    tl_eyebrow: '翻訳・通訳ツール',
    // ⚠️ 2026-08-17 更新：旧値は「中日翻訳 + 回訳検証」だったが、ページ側の見出しは
    // とっくに音声通訳を含む内容に変わっていた（キーが未使用のまま放置されていたため
    // 気づかれなかった）。そのまま接続すると日本語だけ古い文言に戻るので値を更新した。
    tl_title: '中日翻訳 · 音声通訳',
    tl_lead:
      'テキスト翻訳・音声リアルタイム通訳に対応。講義や会議の同時通訳にもご利用いただけます。',
    tl_input_label: '入力',
    tl_input_placeholder: '中国語または日本語を入力してください…',
    tl_notice: 'ローカルプレビューでは翻訳機能をご利用いただけません。デプロイ後にお試しください。',
    tl_output_placeholder: '翻訳結果がここに表示されます',
    tl_voice_feed_empty: '「我说」または「对方说」を押して通訳を開始します',
    tl_history_label: '対話記録 / 对话记录',
    tl_history_empty: '翻訳を開始すると記録が表示されます。',
    tl_cta: '翻訳ツールを開く',
    tl_dialog_title: '議事録を生成',
    tl_dialog_body: '議事録を生成しますか？生成後、現在の転写記録が保存されます。',
    tl_dialog_note: '生成には30〜60秒かかります。完了するまでページを閉じないでください。',
    tl_dialog_cancel: 'キャンセル',
    tl_dialog_confirm: '確認',
    tl_summary_title: '生成された議事録',
    tl_summary_close: '✕ 閉じる',
    tl_summary_download: '💾 議事録ダウンロード（Word）',
    tl_summary_new: '➕ 新しい会議',
    tl_btn_gen_summary: '議事録生成',
    tl_btn_abstract: '要約',
    tl_btn_clear: 'クリア',
    tl_text_summary_btn: '会議まとめを生成',

    /* Translation tool — 実行時に書き換わる文言も含む（2026-08-17） */
    tl_error_prefix: 'エラー',
    tl_tab_voice: '音声通訳',
    tl_tab_text: 'テキスト翻訳',
    tl_status_ready: '準備完了',
    tl_status_ready_voice: 'Deepgram · 準備完了',
    tl_status_translating: '翻訳中…',
    tl_status_local: 'ローカルプレビュー — API 未接続',
    tl_count_voice: '{n} 件',
    tl_count_exchange: '{n} 件の翻訳',
    tl_browser_warn:
      'お使いのブラウザは音声入力に対応していません。Chrome または Edge をご利用ください。',
    tl_spk_a: '甲',
    tl_spk_b: '乙',
    tl_spk_a_title: '甲（自分）の言語',
    tl_spk_b_title: '乙（相手）の言語',
    tl_marker_me: '自分が話す',
    tl_marker_them: '相手が話す',
    tl_marker_me_title: '自分が話すときに押してください',
    tl_marker_them_title: '相手が話すときに押してください',
    tl_marker_selected: '選択中',
    tl_marker_unselected: '未選択',
    tl_tts_title: '読み上げ',
    tl_badge_auto: '— 自動検出 —',
    tl_badge_zh_ja: '中国語 → 日本語',
    tl_badge_ja_zh: '日本語 → 中国語',
    tl_badge_undetected: '— 検出できません —',
    tl_btn_submit: '翻訳する →',

    /* Proofreader tool（2026-08-17 三言語化） */
    pf_page_title: '原稿校正 — 千里同風',
    pf_title: '原稿校正アシスタント',
    pf_subtitle:
      '誤字 · 重複 · 編集指示の残留 · 事実と論理 · 表現の明確さ · 論証の完全性 · 見出しの整合',
    pf_history: '履歴',
    pf_logout: 'ログアウト',
    pf_history_title: '校正履歴（直近 30 件）',
    pf_clear_all: 'すべて削除',
    pf_close: '閉じる',
    pf_tab_paste: 'テキストを貼り付け',
    pf_tab_upload: 'Word をアップロード',
    pf_input_placeholder: '中国語の原稿をここに貼り付けてください…',
    pf_input_hint: '中国語のニュース原稿・記事・寄稿に対応',
    pf_char_count: '{n} / 20,000 字',
    pf_file_pick: 'クリックして .docx または .txt を選択',
    pf_file_title: 'ファイルをアップロード',
    pf_ref_label: '参考資料（インタビュー記録など・任意）',
    pf_ref_hint:
      'アップロードすると、原稿がその資料に忠実かどうかも点検します。.docx / .txt に対応。',
    pf_ref_title: '参考資料をアップロード',
    pf_loading: '校正中です。しばらくお待ちください（約 10〜30 秒）…',
    pf_check: '校正を開始',
    pf_expand_all: 'すべて展開',
    pf_collapse_all: 'すべて折りたたむ',
    pf_copy_report: 'レポート全文をコピー',
    pf_copied: 'コピーしました ✓',
    pf_copy_failed: 'コピーに失敗しました。テキストを選択して手動でコピーしてください',
    pf_result_hint:
      '項目をクリックすると説明が開きます。✓ を押すと「問題なし」として印を付けられます（元に戻せます）。',
    pf_original_marked: '原文（問題箇所をマーキング済み）',
    pf_ai_disclaimer:
      '以上は AI による生成です。参考情報として扱い、最終判断は人が行ってください。',
    pf_parsing: '解析中…',
    pf_file_ok: '✓ {name}（{n} 字）',
    pf_file_error: 'ファイルの解析に失敗しました。.txt で保存し直してからアップロードしてください',
    pf_ref_error: '参考資料の解析に失敗しました。.txt で保存し直してからアップロードしてください',
    pf_no_history: '履歴はまだありません',
    pf_col_time: '日時',
    pf_col_doc: '原稿',
    pf_col_total: '合計',
    pf_confirm_clear: '校正履歴をすべて削除しますか？',
    pf_over_limit: 'テキストが 20,000 字を超えています（現在 {n} 字）。超過分は切り捨てられます',
    pf_failed: '校正に失敗しました：',
    pf_summary: '{n} 件の問題の可能性を検出しました',
    pf_summary_truncated: '（テキストは 20,000 字に切り詰められました）',
    pf_no_section: '該当するセクションが見つかりません',
    pf_no_issues: '問題は見つかりませんでした',
    pf_count_unit: '{n} 件',
    pf_count_none: 'なし',
    pf_item_issue: '問題',
    pf_item_suggestion: '提案',
    pf_dismiss_title: '問題なしとして印を付ける',
    pf_dismissed_title: '確認済みです。クリックで元に戻します',
    pf_need_paste: 'まず原稿を貼り付けてください',
    pf_need_upload: 'まずファイルをアップロードしてください',
    pf_request_failed: 'リクエストに失敗しました',
    pf_cat_typos: '一、誤字',
    pf_cat_repeat: '二、重複・未完成の文',
    pf_cat_marks: '三、編集指示・挿入メモの残留',
    pf_cat_facts: '四、事実と論理の整合',
    pf_cat_clarity: '五、表現の明確さ',
    pf_cat_argue: '六、論証の完全性',
    pf_cat_title: '七、見出しと本文の整合',
    pf_short_typos: '誤字',
    pf_short_repeat: '重複',
    pf_short_marks: '編集指示',
    pf_short_facts: '事実論理',
    pf_short_clarity: '表現',
    pf_short_argue: '論証',
    pf_short_title: '見出し',

    /* Auth gate (5 つのツールページ共通) */
    ag_verifying: '認証中…',

    /* Document analysis tool */
    an_page_title: '千里同風 — 文書分析ツール',
    an_eyebrow: '分析ツール',
    an_title: '文書分析 · 比較レポート',
    an_lead: '複数の PDF・Word・Excel を読み込み、AI が内容を横断分析してレポートを生成します。',
    an_notice: 'ローカルプレビューでは分析機能をご利用いただけません。デプロイ後にお試しください。',
    an_status: 'ストリーミング出力',
    an_drop_text: 'ファイルをドロップ、またはクリックして選択',
    an_drop_sub: 'PDF · Word (.docx) · Excel (.xlsx/.xls) · CSV ｜ 最大 10 ファイル',
    an_prompt_label: '分析の観点',
    an_prompt_hint: '（省略可・空欄の場合は AI が全体を総合分析します）',
    an_prompt_placeholder: '例：三つの地下鉄の収益モデルを比較し、持続可能性を評価してください',
    an_btn_submit: '分析する',
    an_btn_clear: 'クリア',
    an_result_header: '分析レポート',
    an_loading: '分析中…',
  },

  zh: {
    nav_about: '关于我们',
    nav_team: '团队',
    nav_milestones: '大事记',
    nav_solutions: '解决方案',
    nav_products: '产品',
    nav_demo: '在线演示',
    nav_blog: '博客',

    hero_corp: '千里同風株式会社',
    hero_tagline: '人类对AI陪伴的一切渴望，不过是对灵魂共鸣的向往。',
    hero_scroll: '向下滑动',

    mission_eyebrow: '使命',
    mission_title: '通过融合AI与硬件，缩短人与技术之间的距离。',
    mission_body:
      '我们将生成式AI嵌入硬件产品，打造兼具温度与智识的产品。技术应服务于人——秉持这一理念，我们专注于面向日本市场的产品企划与研发。',

    vision_eyebrow: '愿景',
    vision_title: '创造一个充满温度的AI融入人们日常生活的世界。',
    vision_body: '通过玩具、教具与IoT设备，探索人与AI之间新的关系。这就是我们所追求的未来。',

    values_eyebrow: '价值观',
    values_title: '技术服务于人',
    val1_name: '现实主义',
    val1_desc: '脚踏实地的规划与执行。在追求理想的同时，诚实地寻求可实现的路径。',
    val2_name: '清晰',
    val2_desc: '将复杂的技术转化为每个人都能理解的语言与形式。清晰的沟通是信任的基础。',
    val3_name: '责任',
    val3_desc: '拥有技术力量的人，对其使用方式负责。我们致力于AI的伦理化应用。',

    about_teaser_eyebrow: '关于我们',
    about_teaser_title: '从大阪出发，探索连接人与AI的新形式。',
    about_teaser_body:
      '千里同風株式会社是一家专注于生成式AI硬件产品研究与企划的公司。我们提供从市场调研到产品概念开发的全程支持。',
    about_teaser_cta: '了解团队',

    nav_member: '会员',
    demo_tools_eyebrow: '在线工具',
    demo_tools_title: '会员专属工具',
    demo_tools_body: '以下工具需登录后方可使用。',
    demo_member_badge: '会员专属',

    footer_tagline: '人类对AI陪伴的一切渴望，不过是对灵魂共鸣的向往。',
    footer_nav_heading: '导航',
    footer_contact_heading: '联系方式',
    footer_copy: '© 2024 千里同風株式会社',
    addr_street: '大阪府大阪市淀川区西三国4丁目4-9-7',
    addr_city: '大阪市, 日本',

    team_page_title: '千里同風株式会社 — 团队',
    team_eyebrow: '团队',
    team_title: '我们的团队',
    team_body: '精简的团队，共同开拓AI与硬件的未来。',
    team1_role: '代表取締役',
    team1_bio:
      '千里同風株式会社代表。主导面向日本市场的AI硬件产品的事业开发与市场拓展，专注于产品企划与供应链构建。',
    team2_role: '商业顾问',
    team2_bio:
      '中国注册会计师（CPA）。负责财务战略与跨境商业咨询，支持中日之间的业务开发与财务管理。',

    milestones_page_title: '千里同風株式会社 — 大事记',
    milestones_eyebrow: '大事记',
    milestones_title: '公司历程',
    milestones_body: '了解千里同風株式会社从成立至今的发展历程。',
    ms1_event: '千里同風株式会社 成立',
    ms1_desc: '于大阪市成立。作为专注于生成式AI硬件研究与企划的公司正式启动。',
    ms2_event: '开始市场调研与产品企划',
    ms2_desc:
      '启动面向日本市场的生成式AI硬件产品调研与概念开发。探索教育、医疗、消费电子及公共服务领域的可能性。',
    ms3_event: '官方网站上线',
    ms3_desc: '千里同風株式会社官方网站全新上线，向全球传达公司愿景与服务内容。',

    solutions_page_title: '千里同風株式会社 — 解决方案',
    solutions_eyebrow: '解决方案',
    solutions_title: '产品与服务',
    solutions_body:
      '融合生成式AI与硬件的全新产品类别。我们在教育、IoT与娱乐领域，探索人与AI的新型关系。',
    services_eyebrow: '服务',
    services_title: '我们能提供什么',
    srv1_name: '市场与行业调研',
    srv1_desc: '跨境分析、竞争评估、用户洞察。基于对日本市场的深度理解，提供专业调研服务。',
    srv2_name: '产品企划与市场进入支持',
    srv2_desc: '从供应链调研、用户研究、概念开发，到合作伙伴促成，提供全链条支持。',
    srv3_name: 'AI集成硬件开发',
    srv3_desc: '支持集成生成式AI、图像识别、语音界面的硬件产品企划与原型开发。',
    coming_soon: '即将发布',
    product1_category: '教育',
    product1_name: 'AI学习设备',
    product1_desc: '搭载生成式AI技术的儿童学习设备。通过互动对话深化学习体验。',
    product2_category: 'IoT',
    product2_name: '图像识别 IoT设备',
    product2_desc: '搭载高精度图像识别功能的智能IoT设备。理解环境并做出恰当响应。',
    product3_category: '娱乐',
    product3_name: 'AI互动玩具',
    product3_desc: '与生成式AI联动的新一代互动玩具。培育孩子的创造力与感性。',

    demo_page_title: '千里同風株式会社 — 在线演示',
    demo_eyebrow: '在线演示',
    demo_title: '体验功能',
    demo_intro: '您可以在浏览器中直接体验我们正在开发的功能。各演示将持续更新。',
    demo1_title: '图像识别演示',
    demo1_desc: 'AI实时分析识别您的摄像头画面或上传的图片文件。',
    demo3_title: '语音界面演示',
    demo3_desc: '演示通过语音命令控制设备的交互界面。',
    demo4_title: '情感识别演示',
    demo4_desc: '演示从面部表情与声音中识别情感的AI模型。',
    demo_coming: '即将发布',

    analysis_title: '文件分析 · 对比报告',
    analysis_desc:
      '上传多份 PDF、Word、Excel，AI 跨文件交叉分析，自动生成对比报告。适合商业模型比较与调研分析。',
    analysis_cta: '打开分析工具',

    lifestory_title: '生平故事 · 人生访谈',
    lifestory_desc:
      '约 100 个精心设计的问题，以文字或语音作答，AI 为你撰写完整的人生传记。每次几题，大约一个月完成。',
    lifestory_cta: '开始记录',

    japanese_title: '日语基础学习工具',
    japanese_desc:
      '内置 214 个常用动词词库，自动生成五段・一段・不规则动词变形，含中英双语释义。支持查表、翻牌练习、随机小测试三种模式。',
    japanese_cta: '开始学习',

    proofreader_label: 'Live · 会员限定',
    proofreader_title: '中文文稿校对助手',
    proofreader_desc:
      '上传 Word 或粘贴文本，自动检查错别字、重复句、编辑指令残留及前后逻辑冲突，输出分类校对报告。',
    proofreader_cta: '开始校对',

    bids_label: 'Internal · 会员限定',
    bids_title: '大阪市招标信息监控',
    bids_desc:
      '每日自动抓取大阪市政府发布的業務委託与物品供給招标公告，提供中文摘要，便于快速筛选适合小型企业的项目。',
    bids_cta: '查看招标信息',

    cat_translation: '翻译',
    cat_analysis: '分析',
    cat_story: '记录',
    cat_learning: '学习',
    demo_label_frontend: 'Live · 纯前端',

    blog_page_title: '千里同風株式会社 — 博客',
    blog_eyebrow: '博客',
    blog_title: '洞察',
    blog_intro: '记录我们对AI、硬件与日本市场的思考与发现。',
    blog_empty: '文章即将发布，敬请期待。',

    tl_page_title: '千里同風 — 中日翻译·语音口译工具',
    tl_eyebrow: '翻译·口译工具',
    tl_title: '中日翻译 · 语音口译',
    tl_lead: '支持文字翻译及语音实时口译，适用于授课和会议场景。',
    tl_input_label: '输入',
    tl_input_placeholder: '请输入中文或日文…',
    tl_notice: '本地预览不支持翻译功能，请部署后使用。',
    tl_output_placeholder: '译文将显示在这里',
    tl_voice_feed_empty: '按「我说」或「对方说」开始口译',
    tl_history_label: '对话记录 / 対話記録',
    tl_history_empty: '开始翻译后，记录将显示于此。',
    tl_cta: '打开翻译工具',
    tl_dialog_title: '生成会议纪要',
    tl_dialog_body: '确定要生成纪要吗？生成后，当前转录将被保存。',
    tl_dialog_note: '生成纪要需要 30-60 秒，期间请勿关闭页面。',
    tl_dialog_cancel: '取消',
    tl_dialog_confirm: '确定',
    tl_summary_title: '生成的会议纪要',
    tl_summary_close: '✕ 关闭',
    tl_summary_download: '💾 下载纪要（Word）',
    tl_summary_new: '➕ 新建会议',
    tl_btn_gen_summary: '生成纪要',
    tl_btn_abstract: '摘要',
    tl_btn_clear: '清空',
    tl_text_summary_btn: '生成会议摘要',

    /* Translation tool — 含运行时改写的文案（2026-08-17） */
    tl_error_prefix: '错误',
    tl_tab_voice: '语音口译',
    tl_tab_text: '文字翻译',
    tl_status_ready: '准备就绪',
    tl_status_ready_voice: 'Deepgram · 准备就绪',
    tl_status_translating: '翻译中…',
    tl_status_local: '本地预览 — API 未连接',
    tl_count_voice: '{n} 条',
    tl_count_exchange: '{n} 条翻译',
    tl_browser_warn: '您的浏览器不支持语音输入，请使用 Chrome 或 Edge。',
    tl_spk_a: '甲',
    tl_spk_b: '乙',
    tl_spk_a_title: '甲方语言（我）',
    tl_spk_b_title: '乙方语言（对方）',
    tl_marker_me: '我说',
    tl_marker_them: '对方说',
    tl_marker_me_title: '我说话时按此按钮',
    tl_marker_them_title: '对方说话时按此按钮',
    tl_marker_selected: '选中',
    tl_marker_unselected: '未选中',
    tl_tts_title: '朗读',
    tl_badge_auto: '— 自动检测 —',
    tl_badge_zh_ja: '中文 → 日文',
    tl_badge_ja_zh: '日文 → 中文',
    tl_badge_undetected: '— 无法检测 —',
    tl_btn_submit: '开始翻译 →',

    /* Proofreader tool（2026-08-17 三语化） */
    pf_page_title: '文稿校对 — 千里同風',
    pf_title: '文稿校对助手',
    pf_subtitle: '错别字 · 重复 · 编辑残留 · 事实逻辑 · 表述清晰 · 论证完整 · 标题一致',
    pf_history: '历史',
    pf_logout: '退出',
    pf_history_title: '历史校对记录（最近 30 次）',
    pf_clear_all: '清除全部',
    pf_close: '关闭',
    pf_tab_paste: '粘贴文本',
    pf_tab_upload: '上传 Word',
    pf_input_placeholder: '请将中文文稿粘贴于此…',
    pf_input_hint: '支持中文新闻稿、文章、稿件',
    pf_char_count: '{n} / 20,000 字',
    pf_file_pick: '点击选择 .docx 或 .txt 文件',
    pf_file_title: '上传文件',
    pf_ref_label: '参考资料（访谈记录等，可选）',
    pf_ref_hint: '上传后，校对会核查稿件是否忠实于该来源。支持 .docx / .txt。',
    pf_ref_title: '上传参考资料',
    pf_loading: '正在校对，请稍候（约 10–30 秒）…',
    pf_check: '开始校对',
    pf_expand_all: '展开全部',
    pf_collapse_all: '折叠全部',
    pf_copy_report: '复制完整报告',
    pf_copied: '已复制 ✓',
    pf_copy_failed: '复制失败，请手动选择文本复制',
    pf_result_hint: '点击条目展开查看问题说明；点击 ✓ 标记为已确认无误（可恢复）',
    pf_original_marked: '原文（已标注问题片段）',
    pf_ai_disclaimer: '以上内容由 AI 生成，仅供参考，请以人工判断为准',
    pf_parsing: '解析中…',
    pf_file_ok: '✓ {name}（{n} 字）',
    pf_file_error: '文件解析失败，请尝试另存为 .txt 后上传',
    pf_ref_error: '参考资料解析失败，请尝试另存为 .txt 后上传',
    pf_no_history: '暂无历史记录',
    pf_col_time: '时间',
    pf_col_doc: '文稿',
    pf_col_total: '合计',
    pf_confirm_clear: '确定清除全部历史记录？',
    pf_over_limit: '文本超过 20,000 字（当前 {n} 字），超出部分将被截断',
    pf_failed: '校对失败：',
    pf_summary: '发现 {n} 处可能的问题',
    pf_summary_truncated: '（文本已截断至 20,000 字）',
    pf_no_section: '未找到对应章节',
    pf_no_issues: '未发现问题',
    pf_count_unit: '{n} 处',
    pf_count_none: '无',
    pf_item_issue: '问题',
    pf_item_suggestion: '建议',
    pf_dismiss_title: '标记为无误',
    pf_dismissed_title: '已确认无误，点击恢复',
    pf_need_paste: '请先粘贴文稿',
    pf_need_upload: '请先上传文件',
    pf_request_failed: '请求失败',
    pf_cat_typos: '一、错别字',
    pf_cat_repeat: '二、重复或未完成的句子',
    pf_cat_marks: '三、编辑指令和插入提示',
    pf_cat_facts: '四、事实与逻辑一致',
    pf_cat_clarity: '五、表述清晰',
    pf_cat_argue: '六、论证完整',
    pf_cat_title: '七、标题与正文一致性',
    pf_short_typos: '错别字',
    pf_short_repeat: '重复句',
    pf_short_marks: '编辑指令',
    pf_short_facts: '事实逻辑',
    pf_short_clarity: '表述',
    pf_short_argue: '论证',
    pf_short_title: '标题',

    /* Auth gate（五个工具页共用） */
    ag_verifying: '验证身份中…',

    /* Document analysis tool */
    an_page_title: '千里同風 — 文件分析工具',
    an_eyebrow: '分析工具',
    an_title: '文件分析 · 对比报告',
    an_lead: '上传多份 PDF、Word、Excel，AI 跨文件交叉分析，生成对比报告。',
    an_notice: '本地预览不支持分析功能，请部署后使用。',
    an_status: '流式输出',
    an_drop_text: '拖放文件或点击选择',
    an_drop_sub: 'PDF · Word (.docx) · Excel (.xlsx/.xls) · CSV ｜ 最多 10 个文件',
    an_prompt_label: '分析方向',
    an_prompt_hint: '（可留空，留空时 AI 自动综合分析）',
    an_prompt_placeholder: '例：比较三条地铁的盈利模式，评估可持续性',
    an_btn_submit: '开始分析',
    an_btn_clear: '清空',
    an_result_header: '分析报告',
    an_loading: '分析中…',
  },

  en: {
    nav_about: 'About',
    nav_team: 'Team',
    nav_milestones: 'Milestones',
    nav_solutions: 'Solutions',
    nav_products: 'Products',
    nav_demo: 'Online Demo',
    nav_blog: 'Blog',

    hero_corp: 'Senridoufuu Co., Ltd.',
    hero_tagline:
      'Every human desire for closeness with AI is nothing but a yearning for resonance of souls.',
    hero_scroll: 'scroll',

    mission_eyebrow: 'Mission',
    mission_title:
      'Bridging the distance between people and technology through AI-hardware integration.',
    mission_body:
      'We embed generative AI into hardware products to create items with warmth and intelligence. Technology exists for people — guided by this belief, we plan and develop products for the Japanese market.',

    vision_eyebrow: 'Vision',
    vision_title:
      'Creating a world where warm, intelligent AI quietly becomes part of everyday life.',
    vision_body:
      'Through toys, educational tools, and IoT devices, we explore new relationships between humans and AI. This is the future we seek.',

    values_eyebrow: 'Values',
    values_title: 'Technology Serves People',
    val1_name: 'Realism',
    val1_desc:
      'Grounded planning and execution. While holding onto ideals, we honestly pursue achievable paths.',
    val2_name: 'Clarity',
    val2_desc:
      'Translating complex technology into language and forms everyone can understand. Clear communication is the foundation of trust.',
    val3_name: 'Responsibility',
    val3_desc:
      'Those with the power of technology must be responsible for how it is used. We are committed to the ethical application of AI.',

    about_teaser_eyebrow: 'About',
    about_teaser_title: 'From Osaka, exploring new ways to connect people and AI.',
    about_teaser_body:
      'Senridoufuu Co., Ltd. specializes in research and planning for generative AI-embedded hardware products. We offer end-to-end support from market research to product concept development.',
    about_teaser_cta: 'Meet the team',

    nav_member: 'Member',
    demo_tools_eyebrow: 'Online Tools',
    demo_tools_title: 'Member-Only Tools',
    demo_tools_body: 'Available after logging in.',
    demo_member_badge: 'Members Only',

    footer_tagline:
      'Every human desire for closeness with AI is nothing but a yearning for resonance of souls.',
    footer_nav_heading: 'Navigation',
    footer_contact_heading: 'Contact',
    footer_copy: '© 2024 Senridoufuu Co., Ltd.',
    addr_street: '3-chome, Nishimikuni, Yodogawa-ku',
    addr_city: 'Osaka, Japan',

    team_page_title: 'Senridoufuu — Team',
    team_eyebrow: 'Team',
    team_title: 'Our Team',
    team_body: 'A small, focused team exploring the frontier of AI and hardware.',
    team1_role: 'Representative Director',
    team1_bio:
      'Founder of Senridoufuu Co., Ltd. Leads business development and market expansion for AI-embedded hardware products in Japan, focusing on product planning and supply chain construction.',
    team2_role: 'Business Advisor',
    team2_bio:
      'Certified Public Accountant (CPA), China. Provides advisory on financial strategy and cross-border business development, supporting operations between China and Japan.',

    milestones_page_title: 'Senridoufuu — Milestones',
    milestones_eyebrow: 'Milestones',
    milestones_title: 'Our Journey',
    milestones_body:
      "A look at the key moments in Senridoufuu's history, from founding to the present.",
    ms1_event: 'Senridoufuu Co., Ltd. Founded',
    ms1_desc:
      'Established in Osaka. The company launches as a research and planning firm specializing in generative AI-embedded hardware.',
    ms2_event: 'Market Research & Product Planning Begins',
    ms2_desc:
      'Initiated research and concept development for generative AI hardware products targeting the Japanese market, exploring opportunities in education, healthcare, consumer electronics, and public services.',
    ms3_event: 'Official Website Launch',
    ms3_desc:
      "Senridoufuu's official website relaunches, communicating the company's vision and services to a global audience.",

    solutions_page_title: 'Senridoufuu — Solutions',
    solutions_eyebrow: 'Solutions',
    solutions_title: 'Products & Services',
    solutions_body:
      'A new category of products merging generative AI and hardware. We propose new ways for people and AI to relate through education, IoT, and entertainment.',
    services_eyebrow: 'Services',
    services_title: 'What We Offer',
    srv1_name: 'Market & Industry Research',
    srv1_desc:
      'Cross-border analysis, competitor assessment, and user insights — grounded in a deep understanding of the Japanese market.',
    srv2_name: 'Product Planning & Market Entry',
    srv2_desc:
      'End-to-end support from supply chain research and user studies through concept development and partnership facilitation.',
    srv3_name: 'AI-Integrated Hardware Development',
    srv3_desc:
      'Planning and prototyping support for hardware products incorporating generative AI, image recognition, and voice interfaces.',
    coming_soon: 'Coming Soon',
    product1_category: 'Education',
    product1_name: 'AI Learning Device',
    product1_desc:
      'A generative AI-powered learning device for children, deepening understanding through interactive dialogue.',
    product2_category: 'IoT',
    product2_name: 'Image Recognition IoT Device',
    product2_desc:
      'A smart IoT device with high-precision image recognition that understands its environment and responds appropriately.',
    product3_category: 'Entertainment',
    product3_name: 'AI Interactive Toy',
    product3_desc:
      "A next-generation interactive toy connected to generative AI, nurturing children's creativity and sensibility.",

    demo_page_title: 'Senridoufuu — Online Demo',
    demo_eyebrow: 'Online Demo',
    demo_title: 'Experience Our Features',
    demo_intro:
      'Try our features in development directly in your browser. All demos are updated regularly.',
    demo1_title: 'Image Recognition Demo',
    demo1_desc:
      'AI analyzes and identifies images from your camera or uploaded files in real time.',
    demo3_title: 'Voice Interface Demo',
    demo3_desc: 'Demo of an interface that controls devices via voice commands.',
    demo4_title: 'Emotion Recognition Demo',
    demo4_desc: 'Demo of an AI model that recognizes emotions from facial expressions and voice.',
    demo_coming: 'Coming Soon',

    analysis_title: 'Document Analysis · Comparison Report',
    analysis_desc:
      'Upload multiple PDFs, Word docs, or Excel files. AI cross-references content and generates a structured comparison report.',
    analysis_cta: 'Open Analysis Tool',

    lifestory_title: 'Life Story · Personal Interview',
    lifestory_desc:
      'Answer around 100 thoughtfully designed questions by text or voice. AI compiles your answers into a complete life memoir — a few questions at a time, finished in about a month.',
    lifestory_cta: 'Start Recording',

    japanese_title: 'Japanese Verb Learning Tool',
    japanese_desc:
      'Built-in library of 214 common verbs. Auto-generates conjugations for godan, ichidan, and irregular verbs with bilingual (Chinese/English) definitions. Three modes: reference table, flashcards, and quiz.',
    japanese_cta: 'Start Learning',

    proofreader_label: 'Live · Members',
    proofreader_title: 'Chinese Manuscript Proofreader',
    proofreader_desc:
      'Upload a Word file or paste text. Automatically detects typos, duplicate sentences, leftover editing marks, and front-to-back logical inconsistencies, then outputs a categorized proofreading report.',
    proofreader_cta: 'Start Proofreading',

    bids_label: 'Internal · Members',
    bids_title: 'Osaka City Bid Monitor',
    bids_desc:
      'Automatically scrapes daily service and goods-procurement notices published by Osaka City, with Chinese summaries to quickly filter projects suited to small businesses.',
    bids_cta: 'View Bids',

    cat_translation: 'Translation',
    cat_analysis: 'Analysis',
    cat_story: 'Story',
    cat_learning: 'Learning',
    demo_label_frontend: 'Live · Pure Frontend',

    blog_page_title: 'Senridoufuu — Blog',
    blog_eyebrow: 'Blog',
    blog_title: 'Insights',
    blog_intro:
      'Notes on AI, hardware, and the Japanese market — our observations and discoveries.',
    blog_empty: 'Articles coming soon.',

    tl_page_title: 'Senridoufuu — Translation & Interpretation Tool',
    tl_eyebrow: 'Translation & Interpretation',
    tl_title: 'Chinese ⇄ Japanese · Live Interpretation',
    tl_lead:
      'Text translation and real-time voice interpretation — suitable for lectures and meetings.',
    tl_input_label: 'Input',
    tl_input_placeholder: 'Enter Chinese or Japanese…',
    tl_notice: 'Translation is unavailable in local preview. Please try it on the deployed site.',
    tl_output_placeholder: 'The translation will appear here',
    tl_voice_feed_empty: 'Press “我说” or “对方说” to start interpreting',
    tl_history_label: 'Session Log / 対話記録 / 对话记录',
    tl_history_empty: 'Your translation history will appear here.',
    tl_cta: 'Open Translation Tool',
    tl_dialog_title: 'Generate Meeting Minutes',
    tl_dialog_body: 'Generate meeting minutes? The current transcript will be saved.',
    tl_dialog_note: 'Generation takes 30–60 seconds. Please do not close the page.',
    tl_dialog_cancel: 'Cancel',
    tl_dialog_confirm: 'Confirm',
    tl_summary_title: 'Generated Meeting Minutes',
    tl_summary_close: '✕ Close',
    tl_summary_download: '💾 Download Minutes (Word)',
    tl_summary_new: '➕ New Meeting',
    tl_btn_gen_summary: 'Meeting Notes',
    tl_btn_abstract: 'Summary',
    tl_btn_clear: 'Clear',
    tl_text_summary_btn: 'Generate Meeting Summary',

    /* Translation tool — includes strings written at runtime (2026-08-17) */
    tl_error_prefix: 'Error',
    tl_tab_voice: 'Live Interpretation',
    tl_tab_text: 'Text Translation',
    tl_status_ready: 'Ready',
    tl_status_ready_voice: 'Deepgram · Ready',
    tl_status_translating: 'Translating…',
    tl_status_local: 'Local preview — API not connected',
    tl_count_voice: '{n} items',
    tl_count_exchange: '{n} translations',
    tl_browser_warn: 'Your browser does not support voice input. Please use Chrome or Edge.',
    tl_spk_a: 'A',
    tl_spk_b: 'B',
    tl_spk_a_title: 'Language of speaker A (you)',
    tl_spk_b_title: 'Language of speaker B (the other party)',
    tl_marker_me: 'I speak',
    tl_marker_them: 'They speak',
    tl_marker_me_title: 'Press this while you are speaking',
    tl_marker_them_title: 'Press this while the other party is speaking',
    tl_marker_selected: 'Selected',
    tl_marker_unselected: 'Not selected',
    tl_tts_title: 'Read aloud',
    tl_badge_auto: '— Auto-detect —',
    tl_badge_zh_ja: 'Chinese → Japanese',
    tl_badge_ja_zh: 'Japanese → Chinese',
    tl_badge_undetected: '— Cannot detect —',
    tl_btn_submit: 'Translate →',

    /* Proofreader tool (trilingual since 2026-08-17) */
    pf_page_title: 'Proofreading — Senridoufuu',
    pf_title: 'Proofreading Assistant',
    pf_subtitle:
      'Typos · Repetition · Leftover edit marks · Facts & logic · Clarity · Completeness of argument · Heading consistency',
    pf_history: 'History',
    pf_logout: 'Sign out',
    pf_history_title: 'Proofreading history (last 30)',
    pf_clear_all: 'Clear all',
    pf_close: 'Close',
    pf_tab_paste: 'Paste text',
    pf_tab_upload: 'Upload Word',
    pf_input_placeholder: 'Paste your Chinese manuscript here…',
    pf_input_hint: 'For Chinese press releases, articles and manuscripts',
    pf_char_count: '{n} / 20,000 characters',
    pf_file_pick: 'Click to choose a .docx or .txt file',
    pf_file_title: 'Upload a file',
    pf_ref_label: 'Reference material (interview notes etc., optional)',
    pf_ref_hint:
      'If provided, the check also verifies the manuscript against this source. .docx / .txt supported.',
    pf_ref_title: 'Upload reference material',
    pf_loading: 'Proofreading, please wait (about 10–30 seconds)…',
    pf_check: 'Start proofreading',
    pf_expand_all: 'Expand all',
    pf_collapse_all: 'Collapse all',
    pf_copy_report: 'Copy full report',
    pf_copied: 'Copied ✓',
    pf_copy_failed: 'Copy failed — please select the text and copy manually',
    pf_result_hint:
      'Click an item to see the explanation; click ✓ to mark it as verified (reversible).',
    pf_original_marked: 'Original text (problem spans highlighted)',
    pf_ai_disclaimer: 'Generated by AI. For reference only — the final judgement is yours.',
    pf_parsing: 'Parsing…',
    pf_file_ok: '✓ {name} ({n} characters)',
    pf_file_error: 'Could not parse the file. Try saving it as .txt and uploading again',
    pf_ref_error: 'Could not parse the reference file. Try saving it as .txt and uploading again',
    pf_no_history: 'No history yet',
    pf_col_time: 'Time',
    pf_col_doc: 'Manuscript',
    pf_col_total: 'Total',
    pf_confirm_clear: 'Clear the entire proofreading history?',
    pf_over_limit: 'Text exceeds 20,000 characters (currently {n}); the excess will be truncated',
    pf_failed: 'Proofreading failed: ',
    pf_summary: '{n} possible issues found',
    pf_summary_truncated: ' (text truncated to 20,000 characters)',
    pf_no_section: 'No matching section found',
    pf_no_issues: 'No issues found',
    pf_count_unit: '{n}',
    pf_count_none: 'none',
    pf_item_issue: 'Issue',
    pf_item_suggestion: 'Suggestion',
    pf_dismiss_title: 'Mark as verified',
    pf_dismissed_title: 'Verified — click to undo',
    pf_need_paste: 'Please paste your manuscript first',
    pf_need_upload: 'Please upload a file first',
    pf_request_failed: 'Request failed',
    pf_cat_typos: '1. Typos',
    pf_cat_repeat: '2. Repeated or unfinished sentences',
    pf_cat_marks: '3. Leftover edit marks and inserted notes',
    pf_cat_facts: '4. Consistency of facts and logic',
    pf_cat_clarity: '5. Clarity of expression',
    pf_cat_argue: '6. Completeness of argument',
    pf_cat_title: '7. Heading vs. body consistency',
    pf_short_typos: 'Typos',
    pf_short_repeat: 'Repetition',
    pf_short_marks: 'Edit marks',
    pf_short_facts: 'Facts',
    pf_short_clarity: 'Clarity',
    pf_short_argue: 'Argument',
    pf_short_title: 'Headings',

    /* Auth gate (shared by the five tool pages) */
    ag_verifying: 'Verifying…',

    /* Document analysis tool */
    an_page_title: 'Senridoufuu — Document Analysis',
    an_eyebrow: 'Analysis Tool',
    an_title: 'Document Analysis · Comparative Report',
    an_lead:
      'Upload multiple PDF, Word or Excel files; the AI analyses them together and produces a comparative report.',
    an_notice: 'Analysis is unavailable in local preview. Please try it on the deployed site.',
    an_status: 'Streaming output',
    an_drop_text: 'Drop files here, or click to select',
    an_drop_sub: 'PDF · Word (.docx) · Excel (.xlsx/.xls) · CSV | up to 10 files',
    an_prompt_label: 'Focus of the analysis',
    an_prompt_hint: '(optional — blank means a general analysis)',
    an_prompt_placeholder:
      'e.g. Compare the revenue models of the three subway operators and assess their sustainability',
    an_btn_submit: 'Analyse',
    an_btn_clear: 'Clear',
    an_result_header: 'Analysis Report',
    an_loading: 'Analysing…',
  },
};

/* === NAV HTML (shared across all pages) === */
const NAV_HTML = `
<nav class="nav" id="nav">
  <div class="nav__container">
    <a href="./" class="nav__logo">
      <span class="nav__logo-kanji">千里同風</span>
      <span class="nav__logo-sub">株式会社</span>
    </a>
    <div class="nav__right">
      <div class="nav__links">
        <div class="nav__item nav__item--has-dropdown">
          <a href="about/" class="nav__link" data-i18n="nav_about"></a>
          <div class="nav__dropdown">
            <a href="about/" class="nav__dropdown-link" data-i18n="nav_team"></a>
            <a href="about/milestones.html" class="nav__dropdown-link" data-i18n="nav_milestones"></a>
          </div>
        </div>
        <div class="nav__item nav__item--has-dropdown">
          <a href="solutions/" class="nav__link" data-i18n="nav_solutions"></a>
          <div class="nav__dropdown">
            <a href="solutions/" class="nav__dropdown-link" data-i18n="nav_products"></a>
            <a href="solutions/demo.html" class="nav__dropdown-link" data-i18n="nav_demo"></a>
            <a href="solutions/blog/" class="nav__dropdown-link" data-i18n="nav_blog"></a>
          </div>
        </div>
      </div>
      <a href="/account.html" id="nav-member-link" class="nav__link" style="font-size:0.8125rem;opacity:.7;"></a>
      <div class="nav__lang" id="langDesktop">
        <button class="nav__lang-btn" data-lang="ja">日</button>
        <span class="nav__lang-sep">/</span>
        <button class="nav__lang-btn" data-lang="zh">中</button>
        <span class="nav__lang-sep">/</span>
        <button class="nav__lang-btn" data-lang="en">En</button>
      </div>
      <button class="nav__hamburger" id="hamburger" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</nav>
<div class="nav__mobile" id="navMobile">
  <div class="nav__mobile-section">
    <div class="nav__mobile-parent" data-i18n="nav_about"></div>
    <a href="about/" class="nav__mobile-child" data-i18n="nav_team"></a>
    <a href="about/milestones.html" class="nav__mobile-child" data-i18n="nav_milestones"></a>
  </div>
  <div class="nav__mobile-section">
    <div class="nav__mobile-parent" data-i18n="nav_solutions"></div>
    <a href="solutions/" class="nav__mobile-child" data-i18n="nav_products"></a>
    <a href="solutions/demo.html" class="nav__mobile-child" data-i18n="nav_demo"></a>
    <a href="solutions/blog/" class="nav__mobile-child" data-i18n="nav_blog"></a>
  </div>
  <div class="nav__mobile-lang" id="langMobile">
    <button class="nav__mobile-lang-btn" data-lang="ja">日本語</button>
    <button class="nav__mobile-lang-btn" data-lang="zh">中文</button>
    <button class="nav__mobile-lang-btn" data-lang="en">English</button>
  </div>
</div>
`;

/* === FOOTER HTML (shared across all pages) === */
const FOOTER_HTML = `
<footer class="footer">
  <div class="footer__container">
    <div class="footer__top">
      <div>
        <div class="footer__brand-name">千里同風</div>
        <div class="footer__brand-sub">株式会社</div>
        <p class="footer__tagline" data-i18n="footer_tagline"></p>
      </div>
      <div>
        <div class="footer__col-heading" data-i18n="footer_nav_heading"></div>
        <div class="footer__links">
          <a href="about/" class="footer__link" data-i18n="nav_team"></a>
          <a href="about/milestones.html" class="footer__link" data-i18n="nav_milestones"></a>
          <a href="solutions/" class="footer__link" data-i18n="nav_products"></a>
          <a href="solutions/demo.html" class="footer__link" data-i18n="nav_demo"></a>
          <a href="solutions/blog/" class="footer__link" data-i18n="nav_blog"></a>
        </div>
      </div>
      <div>
        <div class="footer__col-heading" data-i18n="footer_contact_heading"></div>
        <address class="footer__address">
          <a href="mailto:yuki.minami@senridf.com">yuki.minami@senridf.com</a><br><br>
          <span data-i18n="addr_street"></span><br>
          <span data-i18n="addr_city"></span>
        </address>
      </div>
    </div>
    <div class="footer__bottom">
      <span class="footer__copy" data-i18n="footer_copy"></span>
    </div>
  </div>
</footer>
`;

/* === LANGUAGE STATE === */
// 后台就地编辑器用 ?lang= 强制页面语言（不写 localStorage，不影响站长本人正常浏览的语言偏好）
const LANG_PARAM = new URLSearchParams(location.search).get('lang');
const VALID_LANGS = ['ja', 'zh', 'en'];
let currentLang =
  (VALID_LANGS.includes(LANG_PARAM) && LANG_PARAM) || localStorage.getItem('sdf_lang') || 'ja';

/* 把 {n} / {name} 这类占位符替换成实际值。
   n 是最常见的计数场景的简写，params 是 JSON 形式的任意键值。
   ⚠️ 参数解析失败时**保留原文**而不是返回空——坏数据不该让文案消失。 */
function fillParams(text, n, paramsJson) {
  let out = String(text);
  if (n !== undefined) out = out.split('{n}').join(n);
  if (paramsJson) {
    try {
      const p = JSON.parse(paramsJson);
      for (const k of Object.keys(p)) out = out.split('{' + k + '}').join(p[k]);
    } catch (err) {
      console.error('[main] bad data-i18n-params:', err);
    }
  }
  return out;
}

/* === APPLY TRANSLATIONS === */
function applyTranslations(lang) {
  const t = T[lang] || T.ja;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key] === undefined) return;
    // 带参数的文案（「3 件」「✓ 报告.docx（12,345 字）」）把参数存在 dataset 上，
    // 值里写 {n} / {name} 这样的占位符。这样切语言时参数不会丢——
    // 直接把整句写死的话，重新翻译会把数字和文件名一起抹掉。
    el.textContent = fillParams(t[key], el.dataset.i18nN, el.dataset.i18nParams);
  });
  // 属性也要能翻译：textContent 管不到 placeholder / title，而工具页的输入框提示、
  // 以及靠 title 做无障碍名字的图标按钮，都是用户看得见的文案。
  // ⚠️ data-i18n 会覆写 textContent，所以**有子元素的容器不要挂 data-i18n**——
  // 会把子元素整个抹掉。要翻译的文字请自己包一层 <span>。
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (t[key] !== undefined) el.setAttribute('placeholder', t[key]);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (t[key] !== undefined) el.setAttribute('title', t[key]);
  });
  // Active state on language buttons
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  // html lang attr
  const langMap = { ja: 'ja', zh: 'zh-CN', en: 'en' };
  document.documentElement.lang = langMap[lang] || 'ja';
  // Page title
  const titleKey = document.body.dataset.pageTitle;
  if (titleKey && t[titleKey]) document.title = t[titleKey];
  updateNavMember();
}

/* === SWITCH LANGUAGE === */
function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('sdf_lang', lang);
  applyTranslations(lang);
}

/* === i18n API for inline page scripts ===
   工具页的主逻辑写在内联 <script> 里，拿不到这个模块作用域的 T。
   没有这个入口，运行时写入的文案只能硬编码——那不但绕过整套 i18n，
   还有个更隐蔽的后果：**切语言时它们不会更新**，页面会变成半中半日。
   sdfSetText 把 key 记在 dataset 上，所以之后每次 applyTranslations
   都会重新翻译它，切语言仍然有效。 */
window.sdfT = function (key, fallback) {
  const t = T[currentLang] || T.ja;
  if (t[key] !== undefined) return t[key];
  if (T.ja[key] !== undefined) return T.ja[key];
  return fallback !== undefined ? fallback : key;
};

/** 动态插入 DOM 之后重新翻译一遍（新插入的节点没经历过初次 applyTranslations）。 */
window.sdfApplyI18n = function () {
  applyTranslations(currentLang);
};

/** 运行时设置 title 属性（同样记 key，切语言时会被重新翻译）。 */
window.sdfSetTitle = function (el, key) {
  if (!el) return;
  el.dataset.i18nTitle = key;
  el.setAttribute('title', window.sdfT(key));
};

/**
 * 写入译文并记住 key + 参数，使其在切语言时能被重新翻译。
 * @param {Element} el
 * @param {string} key
 * @param {number|Object} [arg] 数字 → 填 {n}；对象 → 按键名填 {xxx}
 */
window.sdfSetText = function (el, key, arg) {
  if (!el) return;
  el.dataset.i18n = key;
  delete el.dataset.i18nN;
  delete el.dataset.i18nParams;
  if (typeof arg === 'number' || typeof arg === 'string') el.dataset.i18nN = String(arg);
  else if (arg && typeof arg === 'object') el.dataset.i18nParams = JSON.stringify(arg);
  el.textContent = fillParams(window.sdfT(key), el.dataset.i18nN, el.dataset.i18nParams);
};

/* === NAV MEMBER STATUS === */
function updateNavMember() {
  const el = document.getElementById('nav-member-link');
  if (!el) return;
  const email = localStorage.getItem('sdf_user_email');
  const t = T[currentLang] || T.ja;
  if (email) {
    const name = email.split('@')[0];
    el.textContent = '● ' + (name.length > 10 ? name.slice(0, 10) + '…' : name);
    el.style.color = 'var(--c-accent)';
    el.style.opacity = '1';
    el.title = email;
  } else {
    el.textContent = t.nav_member || 'メンバー';
    el.style.color = '';
    el.style.opacity = '.7';
    el.title = '';
  }
}

/* === INJECT SHARED COMPONENTS === */
function injectShared() {
  const navEl = document.getElementById('nav-placeholder');
  const footerEl = document.getElementById('footer-placeholder');
  if (navEl) navEl.innerHTML = NAV_HTML;
  if (footerEl) footerEl.innerHTML = FOOTER_HTML;

  // Bind language buttons
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => switchLang(btn.dataset.lang));
  });

  // Mobile hamburger toggle
  const hamburger = document.getElementById('hamburger');
  const navMobile = document.getElementById('navMobile');
  if (hamburger && navMobile) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('is-open');
      navMobile.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Close mobile nav on link click
    navMobile.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('is-open');
        navMobile.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // Nav backdrop on scroll
  const navBar = document.getElementById('nav');
  if (navBar) {
    const onScroll = () => navBar.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mark active nav link
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav__link').forEach((link) => {
    const href = link.getAttribute('href').replace(/\/$/, '') || '/';
    if (href === path || (href !== '' && href !== '/' && path.startsWith(href))) {
      link.classList.add('is-active');
    }
  });

  updateNavMember();
}

/* === SCROLL ANIMATIONS === */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
  );

  document.querySelectorAll('[data-animate]').forEach((el) => observer.observe(el));
}

/* === CONTENT IMAGES ===
   content.json 的 images 字段：{key: 仓库内路径}。key 对应页面里 data-image-key 元素，
   找不到对应 key 时保持页面原有内容（monogram 等占位符）不变，两种状态自然共存。 */
function applyImages(images) {
  Object.entries(images).forEach(([key, path]) => {
    if (!path) return;
    const el = document.querySelector(`[data-image-key="${key}"]`);
    if (!el) return;
    let img = el.querySelector('.content-image');
    if (!img) {
      img = document.createElement('img');
      img.className = 'content-image';
      img.alt = '';
      el.style.position = 'relative';
      el.appendChild(img);
    }
    img.src = path.startsWith('/') ? path : '/' + path;
  });
}

/* === Cloudflare Web Analytics ===
   隐私优先、无 cookie 的访问统计（替代手搓 Firestore 统计的更好仪表盘）。
   token 是公开的客户端标识，非密钥。动态注入以覆盖所有加载 main.js 的页面。 */
function injectAnalytics() {
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', '{"token": "8bcffe16aa9b4adb8c0a7fd9516ac2d8"}');
  document.head.appendChild(s);
}

/* === INIT ===
   每一块共享初始化单独包 try/catch——某一块报错只在控制台留痕，不阻断其余几块继续跑
   （比如导航注入失败，不应该连累语言切换或滚动动画）。 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    injectShared();
  } catch (err) {
    console.error('[main] injectShared failed:', err);
  }
  try {
    injectAnalytics();
  } catch (err) {
    console.error('[main] injectAnalytics failed:', err);
  }
  fetch('/content.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((ov) => {
      try {
        ['ja', 'zh', 'en'].forEach((l) => {
          if (ov[l]) Object.assign(T[l], ov[l]);
        });
      } catch (err) {
        console.error('[main] merging content.json translations failed:', err);
      }
      try {
        if (ov.images) applyImages(ov.images);
      } catch (err) {
        console.error('[main] applyImages failed:', err);
      }
    })
    .catch(() => {})
    .finally(() => {
      try {
        applyTranslations(currentLang);
      } catch (err) {
        console.error('[main] applyTranslations failed:', err);
      }
      try {
        initScrollAnimations();
      } catch (err) {
        console.error('[main] initScrollAnimations failed:', err);
      }
    });
});
