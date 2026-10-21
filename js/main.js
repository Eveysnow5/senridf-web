/* ============================================================
   千里同風株式会社 — Main JavaScript
   i18n | Navigation | Scroll Animations
   ============================================================ */

/* 页脚版权年＝公司成立年 2025，固定不变（作者 2026-10-19 决定，三语统一）。
   以前取当年年份（{year} 占位符），但后台编辑器改的是渲染后的文字，中文被存成了
   「© 2025」、日英仍是当年，三语对不上。现在 footer_copy 三语 + account.html 共四处都是 2025，
   tests/i18n-runtime.test.mjs 断言四处一致。 */

/* === TRANSLATION DATA === */
const T = {
  ja: {
    /* Navigation */
    nav_about: '私たちについて',
    nav_team: 'チーム',
    nav_milestones: '沿革',
    nav_solutions: 'ソリューション',
    nav_products: '製品',
    nav_demo: 'アプリ',
    nav_blog: 'ブログ',

    /* Hero */
    hero_corp: '千里同風株式会社',
    home_page_title: '千里同風株式会社 — AIを、日々の仕事に役立つ形に（大阪）',
    hero_tagline: '人間がAIとの寄り添いを求めるすべての願いは、魂の共鳴への渇望にほかならない。',

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
    val1_desc:
      '現実に根ざした企画と実行。理想を掲げながらも、実現可能な道筋を誠実に追い求めます。だからこそまずはオンラインのツールでAIを日々の仕事に役立つ形にし、その先にAIを組み込んだハードウェアを見据えています。',
    val2_name: '明確さ',
    val2_desc:
      '複雑な技術を、誰もが理解できる言葉と形に変える。明確なコミュニケーションが信頼の土台です。AIが何をして、データがどこへ行くのかも、はっきりお伝えします。',
    val3_name: '責任',
    val3_desc:
      'テクノロジーの力を持つ者が、その使い方に責任を持つ。私たちはAIの倫理的活用にコミットします。最後の判断は使う人に委ね、結果を人が確かめられる形でお届けします。',

    /* About teaser (homepage) */
    showcase_eyebrow: 'プロダクトとソリューション',
    showcase_title: '想像を、現実に。',
    showcase_lead:
      'デジタルアシスタントから、そばにいるハードウェアまで。AIが現実の場面で活きるかたちを探っています。',
    showcase_app_tag: 'ソリューション',
    showcase_app_desc:
      'PDF・Excelの注文書をAIが読み取り、受注台帳に自動で整理。登録なしで無料でお試しいただけます。',
    showcase_hw_tag: 'プロダクト',
    showcase_hw_desc: '生成AIを玩具・教具・IoTデバイスに組み込み、日常に寄り添う製品を開発中です。',
    showcase_more: '製品・ソリューション一覧',
    journal_eyebrow: 'ブログ',
    journal_title: '探索を記録し、考えを分かち合う。',
    journal_lead: '技術とプロダクト、そして人とAIのあいだで起きている変化について。',
    journal1_tag: 'Perspectives',
    journal1_name: '視点と考察',
    journal1_desc: 'AI・社会・未来の関係についての考察。',
    journal2_tag: 'Building',
    journal2_name: '開発ノート',
    journal2_desc: '構想から実験、製品化までのありのままの記録。',
    journal3_tag: 'Updates',
    journal3_name: 'お知らせ',
    journal3_desc: 'プロジェクトの進捗、協業のお知らせ、会社の日常。',
    journal_more: 'すべての記事を読む',
    about_teaser_eyebrow: '千里同風とは',
    about_teaser_title: '大阪から、AIと人をつなぐ新しい形を探して。',
    about_teaser_body:
      '千里同風株式会社は、大阪を拠点にAIの研究と実用化に取り組む会社です。いまはオンラインのAIツールと業務の自動化を提供し、その先に生成AIを組み込んだハードウェアの開発を進めています。',
    about_teaser_cta: 'チームを見る',

    nav_member: 'メンバー',
    demo_member_badge: '会員限定',

    /* Footer */
    footer_tagline: '人間がAIとの寄り添いを求めるすべての願いは、魂の共鳴への渇望にほかならない。',
    footer_nav_heading: 'ナビゲーション',
    footer_contact_heading: 'お問い合わせ',
    nav_privacy: 'プライバシーポリシー',
    nav_consult: '無料相談',
    nav_company: '会社概要',
    contact_page_title: '無料相談・お問い合わせ',
    contact_eyebrow: 'お問い合わせ',
    contact_title: '無料相談',
    contact_lead:
      'AIの活用や業務の自動化、ツールについてのご質問など、内容を問わずお気軽にご相談ください。1営業日以内にご返信します。費用はかかりません。',
    contact_mail_pre: 'メールでも受け付けています：',
    footer_copy: '© 2025 千里同風株式会社',
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
    company_page_title: '千里同風株式会社 — 会社概要',
    company_eyebrow: '会社概要',
    company_title: '会社概要',
    co_name_h: '商号',
    co_name_v: '千里同風株式会社',
    co_est_h: '設立',
    co_rep_h: '代表者',
    co_rep_v: '代表取締役　南 雪',
    co_addr_h: '所在地',
    co_addr_v: '〒532-0006 大阪府大阪市淀川区西三国4丁目4-9-7',
    co_biz_h: '事業内容',
    co_biz1: 'AI技術の研究、リサーチ及び情報提供',
    co_biz2: 'AIを活用した業務改善・効率化のコンサルティング、クラウドサービスの提供',
    co_biz3: 'ソフトウェア・ハードウェアの企画開発、販売',
    co_biz4: '市場調査の受託、経営コンサルティング',
    co_contact_h: 'お問い合わせ',
    co_contact_cta: '無料相談フォーム',
    milestones_page_title: '千里同風株式会社 — 沿革',
    milestones_eyebrow: '沿革',
    milestones_title: '会社の歩み',
    milestones_body: '千里同風株式会社の設立から現在までの歩みをご覧ください。',
    ms1_event: '千里同風株式会社 設立',
    ms1_desc: '大阪市にて設立。AIの研究と、AIを組み込んだ製品・サービスの企画を事業として始動。',
    ms2_event: '公式ウェブサイト 公開',
    ms2_desc: '公式ウェブサイトを公開。最初のAIツール「中日翻訳」も同時にリリース。',
    ms3_event: 'オンラインAIツール 順次公開',
    ms3_desc:
      '文書分析・人生インタビュー・日本語動詞活用・入札情報モニタリング・中国語原稿校正を順次公開。',
    ms4_event: '受発注の自動化 デモ公開',
    ms4_desc: '注文書をAIで受注台帳に整形する、中小企業向けの業務自動化を開始。',

    /* Solutions page */
    solutions_page_title: '千里同風株式会社 — ソリューション',
    solutions_eyebrow: 'ソリューション',
    solutions_title: '製品・サービス',
    // ── 受発注→受注台帳 ランディング（lead-gen Stage A, 2026-09-13）──
    o2l_page_title: '受発注の自動化',
    o2l_card_title: '受発注 · Excel自動化',
    o2l_card_desc:
      '注文書（PDF・Excel）をアップロードすると、AIが受注台帳に整形。まずは無料でお試し。',
    o2l_card_cta: '試してみる',
    o2l_eyebrow: '受発注の自動化',
    o2l_hero_title: '注文書、まだ手入力していませんか？',
    o2l_hero_lead:
      'PDF・Excelの注文書を、AIが自動で受注台帳に。毎日の転記とチェックを、なくします。',
    o2l_hero_cta: '無料で試す',
    o2l_hero_cta_note: '登録なしで1回、登録で3回まで無料。',
    o2l_ex_eyebrow: '変換例',
    o2l_ex_title: 'この注文書が、この台帳になります',
    o2l_ex_lead: '架空のサンプル注文書を、実際にAIで整形した結果です。',
    o2l_ex_before: '整形前：注文書（PDF）',
    o2l_ex_after: '整形後：受注台帳（Excelでダウンロード）',
    o2l_ex_img_alt: 'サンプル注文書（株式会社サンプル商事から大阪サンプル卸株式会社宛、明細5行）',
    o2l_ex_p1: '得意先は差出人から読み取ります（「御中」の宛先＝自社とは区別）。',
    o2l_ex_p2: '小計・消費税・合計は明細ではないので、台帳の行にしません。',
    o2l_ex_p3: '明細ごとの納期指定（5行目）は、見出しの納期より優先します。',
    o2l_ex_note:
      '※ 書式によっては読み違えることがあります。ダウンロード前に必ず内容をご確認ください。（備考列は省略して表示）',
    o2l_faq_eyebrow: 'よくある質問',
    o2l_faq_title: '導入前によくいただく質問',
    o2l_faq_q1: '読み取りの精度は？',
    o2l_faq_a1:
      '当社のサンプル注文書では、得意先・品番・数量・単価・金額・納期まで正解と一致することを本番環境で確認しています。ただし書式によっては読み違えることがあるため、ダウンロード前に必ず人が確認する前提でお使いください。個別構築では、御社の実際の注文書で確かめながら調整します。',
    o2l_faq_q2: 'どんなファイルに対応していますか？',
    o2l_faq_a2:
      '文字情報を含むPDF・Excel・CSVに対応しています。スキャンした書類や写真（画像）の読み取りは、精度を確認中のため現在準備中です。',
    o2l_faq_q3: '弥生や販売管理ソフトと連携できますか？',
    o2l_faq_a3:
      'ソフトとの直接連携（API）には現在対応していません。お使いのソフトの取込（インポート）形式に合わせたExcelをお渡しします。',
    o2l_faq_q4: '取引先の注文データを送っても大丈夫ですか？',
    o2l_faq_a4:
      'ファイルの読み取りはお使いのブラウザ内で行い、ファイル本体は送信しません。「AIで台帳に整形」を押したときだけ、読み取った文字を当社サーバー経由でAIに送信し、当社サーバーでは保存しません。使用するAIはデモ欄に表示しています。詳しくはプライバシーポリシーをご覧ください。',
    o2l_faq_q5: '相談すると、いつ返事がもらえますか？',
    o2l_faq_a5: '1営業日以内にご返信します。ご相談は無料です。',
    o2l_faq_q6: '料金には何が含まれますか？',
    o2l_faq_a6:
      '要件のヒアリング、入力（注文書）と出力（台帳・取込用Excel）の形式の確定、完成品の納品、2回までの修正が含まれます。保守・改善は任意で、別途月額です。',
    o2l_faq_q7: '納期はどのくらいですか？',
    o2l_faq_a7:
      '対象のファイルをすべてご提供いただいてから、最短1営業日で初回の台帳をお届けします。調整を含む完成時期は、内容に応じてご相談のうえ決定します。',
    o2l_flow_eyebrow: 'こんな作業、ありませんか？',
    o2l_flow_title: '注文書を、手で台帳に写す毎日',
    o2l_before_label: '今のやり方',
    o2l_before_1: '取引先からPDF・Excelの注文書が届く',
    o2l_before_2: '内容を目視で確認する',
    o2l_before_3: '受注台帳に1行ずつ手入力する',
    o2l_before_4: '入力ミスがないか照合する',
    o2l_after_label: '自動化すると',
    o2l_after_1: '注文書をアップロードする',
    o2l_after_2: 'AIが内容を読み取る',
    o2l_after_3: '受注台帳が自動でできあがる',
    o2l_after_4: '人は確認して、Excelでダウンロード',
    o2l_pain_eyebrow: 'よくあるお悩み',
    o2l_pain_title: 'その手作業、こんな負担になっていませんか',
    o2l_pain1_title: '毎日の転記に時間',
    o2l_pain1_desc: '注文が多い日は、台帳への入力だけで数時間。本来の仕事に手が回りません。',
    o2l_pain2_title: '入力ミスと照合の手間',
    o2l_pain2_desc: '手入力は数量や単価の打ち間違いが起きやすく、あとの照合作業も欠かせません。',
    o2l_pain3_title: '取引先ごとに書式がバラバラ',
    o2l_pain3_desc: 'テンプレートでは対応しきれない書式の違いも、AIなら文脈から読み取れます。',
    o2l_demo_eyebrow: '試してみる',
    o2l_demo_title: 'お手元の注文書で、実際に変換',
    o2l_demo_lead:
      '注文書（PDF・Excel・CSV）を選ぶと、受注台帳の形に変換します。ファイルの読み取りはお使いのブラウザ内で行い、ファイル本体はサーバーに送信しません。',
    o2l_drop_text:
      '注文書（PDF・Excel・CSV）をここにドロップ、またはクリックして選択（最大10ファイル）',
    o2l_drop_hint:
      'ファイルの読み取りはブラウザ内で行います（ファイル本体は送信しません）。スキャン・画像は、読み取りのため画像を送信します（送信前に確認）。',
    o2l_sample_btn: 'サンプル注文書で試す',
    o2l_drop_title: 'ファイルを選択',
    o2l_sample_view: 'サンプルの中身を見る（PDF）',
    o2l_ai_send_note:
      '「AIで台帳に整形」を押すと、読み取った文字だけを当社サーバー経由でAIに送信します（ファイル本体は送信しません）。',
    o2l_ai_route_label: '使用するAI：',
    o2l_file_image: '画像',
    o2l_ai_cancelled: '画像の送信をキャンセルしました。',
    o2l_ai_vision_pending:
      '画像・スキャンのOCRは現在準備中です。文字情報入りのPDF・Excel・CSVはそのままご利用いただけます。',
    o2l_cf_title: '画像として読み取りますか？',
    o2l_cf_body:
      'このファイルには文字情報が無いため、画像として読み取ります。この場合、画像そのものが当社サーバー経由で、デモ欄に表示しているAIに送信されます。（文字PDF・Excel・CSVは、ファイル本体を送信しません。）',
    o2l_cf_ok: '送信して読み取る',
    o2l_cf_cancel: 'キャンセル',
    o2l_status_parsing: '読み取り中…',
    o2l_err_toobig: 'ファイルが大きすぎます（5MBまで）。',
    o2l_err_type: '対応していないファイル形式です（PDF・Excel・CSV）。',
    o2l_err_parse: '読み取れませんでした。別のファイルでお試しください。',
    o2l_err_scanned:
      'この PDF は文字レイヤーが無いようです（スキャン画像・写真）。今は文字テキストのある PDF・Excel・CSV のみ対応です（スキャンの読み取りは近日）。',
    o2l_badge_local: '✓ すべてお使いのブラウザ内で処理しました',
    o2l_download: 'Excelでダウンロード',
    o2l_result_note:
      '※ 上は読み取ったファイル。「AIで台帳に整形」で各ファイルを構造化し、1 枚の表に合并してダウンロードできます。',
    o2l_files_skipped: '読み取れず除外:',
    o2l_ai_btn: 'AIで台帳に整形する（無料）',
    o2l_ai_working: 'AIが整形中…',
    o2l_ai_disabled: 'AI整形は近日公開です。読み取り結果は上の表からダウンロードできます。',
    o2l_ai_anon_used: '無料お試し（1回）を使い切りました。登録すると3回までご利用いただけます。',
    o2l_ai_register_link: '無料で登録する →',
    o2l_ai_member_used: '無料お試し（3回）を使い切りました。ぜひ無料でご相談ください。',
    o2l_ai_daily: '本日の無料体験は上限に達しました。時間をおいてお試しください。',
    o2l_ai_toobig: 'ファイルが大きいため、無料体験では先頭部分のみ処理しました。',
    o2l_ai_error: '整形に失敗しました。しばらくして再度お試しください。',
    o2l_ai_login: '準備中です。ページを再読み込みしてお試しください。',
    o2l_ledger_done: '✓ AIが台帳に整形しました',
    o2l_ledger_download: '台帳をExcelでダウンロード',
    o2l_price_eyebrow: '料金',
    o2l_price_title: '小さく始めて、必要な分だけ',
    o2l_price_free_title: 'まずは無料体験',
    o2l_price_free_price: '¥0',
    o2l_price_free_desc: '登録なしで1回、登録すると3回まで無料でお試しいただけます。',
    o2l_price_paid_title: '小規模自動化',
    o2l_price_paid_price: '5万円〜',
    o2l_price_paid_desc:
      '御社の注文書・台帳の形式に合わせて個別に構築します。要件のヒアリング、入力・出力形式の確定、完成品の納品、2回までの修正を含みます。まずは無料でご相談ください。',
    o2l_price_maint: '保守・改善は月5,000円〜（任意）。',
    o2l_trust_eyebrow: '安心してお使いいただくために',
    o2l_trust_title: 'データの取り扱い',
    o2l_trust1:
      'ファイルの読み取りはお使いのブラウザ内で行い、ファイル本体は当社サーバーに送信しません。',
    o2l_trust2:
      '「AIで台帳に整形」を押したときだけ、読み取った文字を当社サーバー経由でAIに送信します（スキャン・画像は画像を送信。送信前に確認します）。使用するAIはデモ欄に表示しています。',
    o2l_trust3: '当社サーバーでは、送信された内容を保存しません。',
    o2l_trust4: '通信はすべて暗号化されています（HTTPS）。',
    o2l_trust_privacy: '詳しい取り扱いは、プライバシーポリシーをご覧ください。',
    o2l_cta_title: 'まずは、今の作業を教えてください。',
    o2l_cta_lead: '無料でお試しいただくか、御社の業務に合わせた自動化をご相談ください。',
    o2l_cta_try: '無料で試す',
    o2l_cta_consult: '無料で相談する',
    o2l_consult_title: '御社の業務に合わせてご相談ください',
    o2l_consult_lead:
      '現状の作業やお困りごとをお書きください。1営業日以内にご返信します。費用はかかりません。',
    o2l_f_name: 'お名前',
    o2l_f_company: '会社名（任意）',
    o2l_f_email: 'メールアドレス',
    o2l_f_message: 'ご相談内容',
    o2l_f_submit: '送信する',
    o2l_f_sending: '送信中…',
    o2l_f_ok: '送信しました。1営業日以内にご返信します。ありがとうございます。',
    o2l_f_invalid: 'お名前・メールアドレス・ご相談内容をご確認ください。',
    o2l_f_error: '送信に失敗しました。時間をおいて再度お試しください。',
    o2l_f_privacy_pre: '送信により',
    o2l_f_privacy_link: 'プライバシーポリシー',
    o2l_f_privacy_post: 'に同意したものとみなします。',
    pp_eyebrow: 'プライバシー',
    pp_title: 'プライバシーポリシー',
    pp_updated: '制定日：2026年10月5日／改定日：2026年10月6日',
    pp_intro:
      '千里同風株式会社（以下「当社」）は、当社ウェブサイト（senridf.com）および各ツール・サービスにおけるお客様の個人情報を、以下の方針に基づき適切に取り扱います。',
    pp_s1_h: '1. 取得する情報',
    pp_s1_b:
      '当社は次の情報を取得することがあります。(1) お問い合わせ・ご相談フォームにご入力いただいたお名前・会社名・メールアドレス・ご相談内容、(2) 会員登録をされた場合のメールアドレス、(3) サイトの利用状況（アクセス日時、閲覧ページ、おおまかな利用回数など）、(4) 各ツールに入力・アップロードされた内容（処理の範囲は第4項をご覧ください）。',
    pp_s2_h: '2. 利用目的',
    pp_s2_b:
      '取得した情報は、お問い合わせへの対応、ご相談・お見積りのご連絡、サービスの提供・改善、不正利用の防止のために利用します。ご本人の同意なく、これらの目的の範囲を超えて利用することはありません。',
    pp_s3_h: '3. 外部サービス・第三者への提供',
    pp_s3_b:
      '法令に基づく場合を除き、お客様の個人情報を第三者に販売・提供することはありません。ただし、サービスの提供のために次の外部サービスを利用しており、処理に必要な範囲でデータが送信されます。',
    pp_s3_qwen:
      '生成AI（Alibaba Cloud「通義千問」／DashScope）— 翻訳・文書整形などのAI処理に利用します。',
    pp_s3_sf:
      '生成AI（SiliconFlow、運営：SILICONFLOW LABS PTE. LTD.〔シンガポール〕、モデル：Google Gemma 4）— 受発注デモのAI整形・画像読み取りに利用します。受発注デモで実際に使用しているAIは、デモ欄に表示します。画像・スキャンは、送信前に確認ダイアログでご同意いただいた場合に限り送信します。',
    pp_s3_google: 'Google / Firebase — ログイン認証とデータ保存（Firestore）に利用します。',
    pp_s3_cf: 'Cloudflare — ウェブサイトの配信とアクセス解析に利用します。',
    pp_s3_dg: 'Deepgram — 音声通訳機能をご利用の場合に、音声をテキスト化するために利用します。',
    pp_s4_h: '4. ブラウザ内での処理について',
    pp_s4_b:
      '受発注デモなど一部のツールでは、テキスト情報を含むPDF・Excel・CSVファイルはお客様のブラウザ内で解析し、ファイルそのものは当社サーバーに送信しません。「AIで整形」をご利用の場合に限り、読み取った文字（画像・スキャンの場合は、確認・同意のうえで画像）を当社サーバー経由で上記の生成AIに送信します。当社サーバーではその内容を保存しません。',
    pp_s5_h: '5. 保存期間',
    pp_s5_b:
      'お問い合わせ・ご相談の内容は、対応および必要な記録のために保管します。アクセス解析などの統計データは一定期間ののち自動的に削除されます。保管が不要になった個人情報は、適切な方法で消去します。',
    pp_s6_h: '6. お客様の権利',
    pp_s6_b:
      'お客様はご自身の個人情報について、開示・訂正・削除・利用停止を求めることができます。ご希望の場合は下記のお問い合わせ先までご連絡ください。ご本人であることを確認のうえ、法令に従って対応します。',
    pp_s7_h: '7. Cookie・アクセス解析',
    pp_s7_b:
      '当社サイトでは、利便性の向上と利用状況の把握のため、Cookieや類似の技術、およびアクセス解析を利用することがあります。これらに個人を直接特定する情報は含めていません。',
    pp_s8_h: '8. お問い合わせ・事業者情報',
    pp_s8_b:
      '本ポリシーに関するお問い合わせ、および個人情報の取り扱いに関するご請求は、下記までご連絡ください。',
    pp_biz_name: '事業者名',
    pp_biz_rep: '代表者',
    pp_biz_addr: '所在地',
    pp_biz_contact: '連絡先',
    pp_biz_addr_val: '大阪市',
    pp_s9_h: '9. 本ポリシーの改定',
    pp_s9_b:
      '当社は、法令の変更やサービスの改善に応じて本ポリシーを改定することがあります。重要な変更がある場合は本ページでお知らせします。',
    solutions_body:
      'まずはオンラインのツールで、AIを日々の仕事に役立つ形に。その先に、生成AIを組み込んだハードウェアの開発を進めています。',
    sol_now_eyebrow: '提供中',
    sol_now_title: 'いま使えるAIツール',
    sol_feat_tag: '業務自動化',
    sol_feat_p1: 'サンプル注文書で、登録なしにすぐ試せます',
    sol_feat_p2: '御社の書式に合わせた個別構築は5万円〜',
    sol_feat_p3: 'ご相談には1営業日以内にご返信',
    sol_feat_cta: '詳しく見る・無料で試す',
    sol_more_pre: '翻訳・文書分析・日本語学習などのAIツールは',
    sol_more_link: 'アプリ一覧',
    sol_more_post: 'からお試しいただけます。',
    sol_dev_eyebrow: '開発中',
    sol_dev_title: 'AIを組み込んだハードウェア',
    sol_dev_badge: '開発中',
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
    demo_page_title: '千里同風株式会社 — アプリストア',
    demo_eyebrow: 'アプリ',
    demo_title: 'アプリストア',
    demo_intro:
      '当社が開発したAIアプリを、ブラウザ上でそのままご利用いただけます。各アプリは随時アップデートされます。',

    analysis_title: '文書分析 · 比較レポート',
    analysis_desc:
      '複数のPDF・Word・Excelをアップロードし、AIが内容を横断分析してレポートを生成。事業モデルの比較・調査分析に。',
    analysis_cta: '分析ツールを開く',

    lifestory_title: '生平故事 · 人生インタビュー',
    lifestory_desc:
      '約100問のインタビューに答えると、AIがあなたの生涯を一冊の物語に。毎回数問ずつ、約一ヶ月で完成。',
    lifestory_cta: '記録を始める',

    japanese_title: '日本語 動詞活用ツール',
    japanese_desc:
      '214語の常用動詞を内蔵。五段・一段・不規則動詞の活用を自動生成し、中英双解付き。一覧・フラッシュカード・小テストの3モード対応。',
    japanese_cta: '学習を始める',

    proofreader_label: 'Live · 会員限定',
    proofreader_title: '中国語原稿 校正アシスタント',
    proofreader_desc:
      'Wordをアップロードまたはテキストを貼り付けると、誤字・重複文・編集指示の残留・前後の論理矛盾を自動チェックし、分類された校正レポートを出力します。',
    proofreader_cta: '校正を始める',

    bids_title: '大阪市 入札情報モニタリング',
    bids_desc:
      '大阪市が公表する業務委託・物品供給の入札公告を毎日自動取得し、中国語要約を提供。小規模事業者向けの案件を素早く絞り込めます。',
    bids_cta: '入札情報を見る',

    /* 機能タグ（toB/toC ではなく機能で分類。1ツールが複数タグを持つ） */
    tag_all: 'すべて',
    tag_speech: '音声認識',
    tag_translate: '翻訳',
    tag_docs: '文書解析',
    tag_generate: 'テキスト生成',
    tag_verify: '校正・検証',
    tag_scrape: '自動収集',
    tag_dict: '辞書・活用',
    tag_empty: '該当するツールはありません。',
    tag_status: '{total} 件中 {n} 件を表示中。',
    badge_open: 'ログイン不要',
    /* カード用の一行説明（長文は各ツールのページ側に置く） */
    tl_one: '中国語と日本語を相互翻訳。回訳を並べて誤訳を確認できます。',
    analysis_one: '複数のPDF・Word・Excelを横断分析し、比較レポートを生成。',
    proofreader_one: '誤字・重複・前後の矛盾をまとめて点検し、分類レポートに。',
    lifestory_one: '約100の質問に答えると、AIがあなたの半生を一冊にまとめます。',
    japanese_one: '214語の動詞活用を自動生成。ログイン不要でそのまま使えます。',
    bids_one: '大阪市の入札公告を毎日収集し、中国語の要約を付けて一覧に。',

    /* Blog page */
    blog_page_title: '千里同風株式会社 — ブログ',
    blog_eyebrow: 'ブログ',
    blog_title: 'インサイト',
    blog_intro: 'AI・ハードウェア・日本市場に関する考察と発見を書き留めています。',
    blog_empty: '記事は近日公開予定です。',
    /* Blog tags（固定映射表。未登记的分类原样显示，见 js/shared/blog-tags.js） */
    blog_tag_ai_hardware: 'AI・ハードウェア',
    blog_tag_research: '市場調査',
    blog_tag_product: '製品開発',
    blog_tag_news: 'お知らせ',
    blog_tag_tech: '技術メモ',

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
    tl_voice_feed_empty: '「自分が話す」または「相手が話す」を押して通訳を開始します',
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
    // 逆翻訳が検証を通らなかった一文につく警告。**隠さない**のが方針
    //（作者の判断：見て分かる失敗のほうが、見抜けない捏造よりましである）
    tl_back_unverified:
      '⚠ 逆翻訳の検証に失敗しました。この一文は未検証です。言い直しをおすすめします',
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
    tl_marker_recording: '● 録音中',
    tl_confirm_clear: '記録をクリアしますか？',
    tl_confirm_new_meeting: '文字起こしの記録をクリアしますか？',
    tl_speak_title: '読み上げ',
    tl_generating: '作成中…',
    tl_local_no_voice: 'ローカル環境では音声機能を使用できません。',
    tl_connecting: '接続中…',
    tl_ws_error: 'WebSocket エラーが発生しました。',
    tl_mic_denied: 'マイクへのアクセスが拒否されました。ブラウザの設定で許可してください。',
    tl_no_speech: '音声を認識できませんでした。マイクの入力と権限をご確認ください。',
    tl_err_download: 'ファイルのダウンロードに失敗しました。もう一度お試しください。',
    tl_err_no_transcript: '文字起こしの記録がないため、議事録を作成できません。',
    tl_err_summary: '議事録の作成に失敗しました（{msg}）。しばらくしてからもう一度お試しください。',
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

    /* Life story tool（2026-08-17 三言語化。⚠️ 質問バンクは翻訳していない——理由は
       docs/tools/04-lifestory.md を参照） */
    ls_page_title: '生涯の物語 · 千里同風',
    ls_back: '← 戻る',
    ls_hdr_title: '生涯の物語',
    ls_btn_gen: '私の物語を生成',
    ls_w_title: 'あなたの物語を記録する',
    ls_w_desc: '十分だと感じたら、AI があなたの伝記を書き上げます。',
    ls_w_desc1: 'いくつか質問します。文字でも音声でもお答えいただけます。',
    ls_w_desc2: '一度に話し切る必要はありません。いつでも中断できます。',
    ls_btn_start: 'はじめる →',
    ls_btn_prev_story: '前回の物語を見る',
    ls_loading_msg: '次の質問を考えています…',
    ls_mic_lbl: '音声入力',
    ls_recording: '録音中… {n} 秒',
    ls_reconnecting: '再接続中…（{n}/2）',
    ls_char_ct: '{n} 字',
    ls_btn_skip: 'この質問をとばす',
    ls_btn_submit: '回答を送信 →',
    ls_btn_continue: '続ける →',
    ls_bw_title: 'ここまでにしましょう',
    ls_btn_more: '回答を続ける',
    ls_btn_rest: '今日はここまで',
    ls_story_hdr_title: '私の生涯の物語',
    ls_btn_back: '← 戻る',
    ls_export: 'エクスポート',
    ls_import: 'インポート',
    ls_reset: 'リセット',
    ls_export_title: 'すべてのデータを JSON で書き出す',
    ls_import_title: 'JSON ファイルからデータを復元する',
    ls_reset_title: 'すべてのデータを削除（復元不可）',
    ls_gen_summary: '{n} 件の回答から物語を生成します',
    ls_gen_summary_cats: '、{n} 個のテーマにわたります。',
    ls_gen_confirm: '生成しますか？',
    ls_writing: 'あなたの物語を執筆しています',
    ls_writing_note: '30〜60 秒ほどかかります…',
    ls_regenerate: '再生成',
    ls_q_num: '第 {n} 問',
    ls_restored: '✓ 未送信の回答を検出し、復元しました。',
    ls_need_answer: 'まず回答を書いてください。または「この質問をとばす」を押してください。',
    ls_understanding: 'あなたの回答を読み取っています…',
    ls_submit_failed: '送信に失敗しました：',
    ls_retry: '再試行',
    ls_clear_filter_continue: '絞り込みを解除して続ける',
    ls_gen_story: '物語を生成',
    ls_today_enough: '今日はここまでにしましょう',
    ls_or_pick_theme: 'または、特定のテーマの質問だけに答える：',
    ls_only_theme: '{cat} のみ',
    ls_all_continue: 'すべて続ける →',
    ls_filtered: '絞り込み中：{theme} に関する質問のみ',
    ls_clear_filter: '絞り込みを解除',
    ls_no_data: '書き出せるデータがありません。',
    ls_downloaded: '✓ データを保存しました',
    ls_confirm_import:
      '{n} 件の回答をインポートします。現在のデータは上書きされます。よろしいですか？',
    ls_confirm_overwrite:
      '現在 {n} 件の回答があります。上書きしますか、統合しますか？（キャンセル＝中止）',
    ls_imported: '✓ {n} 件の回答をインポートしました。ページを再読み込みします。',
    ls_import_failed: 'インポートに失敗しました：',
    ls_confirm_reset: 'すべての回答とデータを削除しますか？この操作は取り消せません。',
    ls_no_speech:
      'お使いのブラウザは音声入力に対応していません。Chrome または Edge をご利用ください。',
    ls_hint_short: '短すぎます。AI が読み取れないかもしれません。もう少し詳しく書いてみませんか？',
    ls_hint_ok: '✓ ちょうどよい長さです',
    ls_hint_long: '⚠ やや長めです。整理できます',
    ls_hint_too_long: '長すぎます。200〜400 字を目安に',
    ls_answered: '{n} 問に回答済み',
    ls_remaining: ' · 残り {n} 問',
    ls_welcome_back: 'おかえりなさい',
    ls_that_place: 'そちら',
    ls_cat_origin: '原点',
    ls_cat_family: '家族',
    ls_cat_growing: '成長',
    ls_cat_work: '仕事',
    ls_cat_turning: '転機',
    ls_cat_bonds: 'つながり',
    ls_cat_setback: '挫折',
    ls_cat_passion: '情熱',
    ls_cat_inner: '内面',
    ls_cat_values: '価値観',
    ls_cat_money: 'お金',
    ls_cat_influence: '影響',
    ls_cat_regret: '心残り',
    ls_cat_mark: '記憶',
    ls_cat_legacy: '受け継ぐもの',
    api_bad_gateway:
      'サーバーが一時的に応答できません（HTTP {status}）。これは当サイトのサービスからの応答ではなく、上流のタイムアウトまたはプラットフォーム側で遮断された可能性が高いです。しばらくしてからお試しください。',
    api_not_found:
      'エンドポイントが見つかりません（HTTP {status}）。デプロイまたはルーティングの問題と思われます。操作に誤りがあるわけではありません。',
    api_not_json:
      'サーバーから想定外の応答が返りました（HTTP {status}）。これは当サイトのサービスからの応答ではありません。',
    ls_answer_placeholder: 'ここに回答を書いてください…',
    ls_privacy_note: '（うち {n} 件はプライベート指定のため分析されません）',
    ls_gen_timeout:
      '生成がタイムアウトしました（サーバーの応答が遅すぎます）。しばらくしてからお試しください。',
    ls_gen_failed: '生成に失敗しました：',
    ls_loading_first: '質問を準備しています…',
    ls_all_answered: 'すべての質問にお答えいただきました。',
    ls_can_gen_now: '{n} 問に回答済みです。ここで物語を作ることも、もう少し続けることもできます。',
    ls_soft_landing:
      '大丈夫です。胸のうちにしまっておきたいこともありますね。\n別の話に移りましょう。',
    ls_well_done: 'お疲れさまでした',
    ls_good_pause: 'ここでひと区切りにしましょう',
    ls_shared_n: '{n} 件のお話をお聞かせいただきました。',
    ls_come_back: 'いつでも続きからどうぞ。回答は保存してあります。',
    ls_bad_format: 'データ形式が正しくありません：answers 配列がありません',
    ls_sum_shared: '{n} 件のお話をお聞かせいただきました',
    ls_sum_themes: '{c} つのテーマ、およそ {n} 文字です。',
    ls_sum_ready: '続ける準備はよろしいですか。',
    ls_theme_done:
      '「{cat}」のテーマは全部お答えいただきました。ほかのテーマを続けますか、それとも物語を作りますか。',
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
    pf_show_dismissed: '確認済みを表示（{n}）',
    pf_hide_dismissed: '確認済みを隠す（{n}）',
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
    ce_ev_h: '証憑（写真・PDF）',
    ce_ev_intro:
      '領収書・請求書・納付書などを写真や PDF のまま入れると、このパソコンの中で文字を読み取り、日付・金額・取引先の下書きを作ります（画像は外に送りません）。確かめて「確認」すると索引簿に載り、日付・金額・取引先で検索できます（電子帳簿保存法の検索要件）。原本は名前も中身も変えずに作業フォルダの evidence/ に保存します。',
    ce_ev_need_folder:
      '証憑は「作業フォルダを選ぶ」でフォルダを開いたときに使えます（原本と索引簿をフォルダに書くため）。',
    ce_ev_add_paper: '紙の証憑を追加（写真・スキャン）',
    ce_ev_add_elec: '電子で受け取ったファイルを追加',
    ce_ev_kinds:
      '「紙」は撮影・スキャンした紙の書類、「電子」はメール・ダウンロード・ネットバンキングで受け取ったデータです（データのまま保存する義務があります）。区分はファイルの作りから仮に判定しています。スキャンしてメールで届いた請求書は見た目が紙でも「電子」です。確認のときに直してください。確認すると、原本はその区分のフォルダに移ります。',
    ce_ev_paper_notice:
      '紙の写しは作業用です。このツールはスキャナ保存の要件（認定タイムスタンプ）を満たさないので、紙の原本を 7 年間保存してください（国税庁 一問一答【スキャナ保存関係】問31・32・59）。',
    ce_ev_drafts:
      '未確認の下書きが {n} 件あります。日付・金額・取引先を確かめて「確認」してください（未確認のものは帳簿に使いません）。',
    ce_ev_q_date: '取引日',
    ce_ev_q_amount: '金額',
    ce_ev_q_party: '取引先',
    ce_ev_err_need:
      '{list}を入れてから確認してください（電子帳簿保存法：日付・金額・取引先で検索できること）',
    ce_ev_q_void: '取消も含む',
    ce_ev_search: '検索',
    ce_ev_clear: 'クリア',
    ce_ev_col_code: '証憑番号',
    ce_ev_code_title: '紙の右上に書いた番号（E2604-07 の形）。灰色の文字は次の番号の案です',
    ce_ev_code_save: '番号を保存',
    ce_ev_col_status: '状態',
    ce_ev_col_doc: '書類',
    ce_ev_col_file: 'ファイル',
    ce_ev_col_bank: '照合先の明細',
    ce_ev_empty: '証憑はまだありません。',
    ce_ev_st_draft: '下書き',
    ce_ev_st_ok: '確認済',
    ce_ev_st_void: '取消',
    ce_ev_kind_paper: '紙',
    ce_ev_kind_elec: '電子',
    ce_ev_confirm: '確認',
    ce_ev_fix: '直す',
    ce_ev_void: '取消',
    ce_ev_reason_ok: '決定',
    ce_ev_reason_need: '理由を入力してください',
    ce_s_note: '⚠ 下の説明を確認',
    ce_c_book_d: '会社・従業員・期首残高・固定資産など、シートごとに記入します。',
    ce_c_bank_t: '銀行明細',
    ce_c_bank_d: 'ネットバンキングの CSV・Excel をそのまま入れます。決算する月の月末まで必要です。',
    ce_pick_tip:
      'フォルダを選ぶ画面にはフォルダだけが表示されます（中のファイルが見えないのは正常です）。作業フォルダを開いてから「フォルダーの選択」を押してください。',
    ce_list_toggle: '項目ごとの確認結果（11 項目）',
    ce_rp_title: '銀行ルールの当たり方',
    ce_rp_sum_ok: '（ルール {n} 本・明細 {rows} 行）',
    ce_rp_sum_warn: '（⚠ 見直すところが {w} か所あります）',
    ce_rp_intro:
      '締める期間（{first}〜{last}）の明細 {rows} 行に、「{sheet}」の表のルールを当ててみた結果です。締める前にルールを直せます。',
    ce_rp_norules:
      '「{sheet}」の表にルールはまだありません。無くても締められます（明細ごとに尋ねます）。',
    ce_rp_unused:
      'どの明細にも当たらないルールが {n} 本あります。「摘要に含まれる字」が明細の摘要とまったく同じか確かめてください（半角カナは半角のまま写します）。',
    ce_rp_multi:
      '複数のルールが当たる明細が {n} 件あります。締めでは推測せず、その明細について尋ねます。当たるルールが一つだけになるように、ルールを直してください。',
    ce_rp_answered: '回答済み',
    ce_rp_hits: 'ルールごとの当たった件数',
    ce_rp_n: '{n} 件',
    ce_rp_more: 'ほか {n} 件',
    ce_rp_n_total: '{n} 件・合計 {a}',
    ce_rp_none_pre:
      'ルールの無い明細は、締めた後にここに出ます。給与・社会保険・税金の支払と自社の口座どうしの振替は自動で照合するので、ルールは要りません。',
    ce_rp_none_zero: 'ルールの無い明細はありません。',
    ce_rp_none:
      'ルールの無い明細が {n} 件（摘要 {k} 種類）あります。同じ摘要が毎月出てくるものは、「{sheet}」の表にルールを書くと次から自動で仕訳されます。',
    ce_ev_reason_fix: '確認済の行を直す理由（訂正削除記録に残ります）',
    ce_ev_reason_void: '取り消す理由（行も原本も消さず、記録に残ります）',
    ce_ev_dup: '{name} は取り込み済みです（同じ中身）',
    ce_ev_err_read:
      '{name} を読めませんでした：{msg}（原本は保存済み。下書きに手で入れてください）',
    ce_ev_reading:
      '読み取り中：{name}（{i}/{n} ファイル・{p}/{pn} 頁）——写真は 1 頁 10〜60 秒かかります',
    ce_ev_done: '{n} 頁を読み取りました（{s} 秒）',
    ce_ev_ocr: '写真・スキャンの文字を読み取る',
    ce_z_queued: '前のファイルの処理が終わってから、続けて {n} 個のファイルを処理します',
    ce_ev_queued: '前のファイルの読み取りが終わってから、続けて {n} 個のファイルを読みます',
    ce_ev_preparing:
      '準備中：{name}（{i}/{n} ファイル）——読み取り助手と読み取りの準備をしています。表の確認が動いているときは、それが終わるのを待ちます',
    ce_ev_helper_idle:
      'Windows のパソコンでは、本機の読み取り助手を起動しておくと、1 ページ約 1 秒で全ページを読みます（画像はこのパソコンから出ません）。無いときはブラウザの中で 1 ページ目だけ読みます（1 ページ 10〜60 秒、その間パソコンに負荷がかかります）。',
    ce_ev_rereading:
      '読み直し中（{i}/{n}）：{name} の {p} 頁目——書類の種類は分かったが検算が通らなかった頁を、ブラウザの中でもう一度読んでいます（1 頁 1〜2 分）。その間に、ほかの下書きを確認してかまいません',
    ce_ev_reread_sum:
      '{r} 頁を、検算が通らなかったのでブラウザでも読み直しました（そのうち {b} 頁は読み直しの方を使いました）',
    ce_ev_helper_on:
      '本機の読み取り助手（{v}）で読みます：1 ページ約 1 秒、全ページ。書類の種類は分かったのに検算が通らなかった頁だけ、全部読んだ後にブラウザの中でもう一度読みます（1 頁 1〜2 分）',
    ce_ev_helper_off:
      '本機の読み取り助手が動いていません。start-ocr-helper.cmd をダブルクリックして起動し、窓は開いたままにしてください。今回はブラウザの中で 1 ページ目だけ読みます（1 ページ 10〜60 秒、その間パソコンに負荷がかかります）',
    ce_ev_helper_lost:
      '本機の読み取り助手が途中で止まりました（{msg}）。残りのスキャンの頁は読んでいません（原本は保存済み）。助手を起動し直して、もう一度入れてください',
    ce_ev_reading_fast: '読み取り中：{name}（{i}/{n} ファイル・{p}/{pn} 頁）',
    ce_ev_ocr_d:
      '書類の種類ごとに検算までできるのは、電気料金・大阪市の水道料金の請求書、年金の保険料の納入告知書、地方税の納付書（QR）、中国の電子発票です。そのほかの書類（領収書・請求書・契約書など）は、書類の言葉から日付・金額・取引先を読みますが、検算はできないので原本と照らしてください。文字の入った PDF は、チェックに関係なくすぐ読みます。',
    ce_ev_pages: '（全 {n} ページ）',
    ce_ev_done_noocr:
      '{f} 個のファイルを保存しました。写真・スキャンの文字は読み取っていません（文字の入った PDF は {n} 頁読みました・{s} 秒）',
    ce_ev_skipped: '{name}：写真・スキャンは読み取らずに保存しました（チェックが外れています）',
    ce_wp_ok:
      '✓ {name} → ワークペーパーから期首残高 {n} 行（{as_of} 現在）と、会社名・決算月・記帳を始める月（{start}）を会社の資料に入れました（前のファイル：{path}）',
    ce_wp_ok_new:
      '✓ {name} → ワークペーパーから会社の資料を作りました：期首残高 {n} 行（{as_of} 現在）・会社名・決算月・記帳を始める月（{start}）。足りないものは、下の確認結果がお知らせします',
    ce_wp_check_ok:
      '{name}：読み取った資産の合計が、ワークペーパーの貸借対照表の資産合計と一致しました（{total} 円）',
    ce_wp_check_ng:
      '△ {name}：読み取った資産の合計（{computed} 円）が、ワークペーパーの貸借対照表の資産合計（{total} 円）と合いません。期首残高を確かめてください',
    ce_wp_added: '{name}：科目表に無い科目を「追加科目」に登録しました：{list}',
    ce_wp_guessed:
      '△ {name}：区分を残高の向きから決めた科目があります（{list}）。「追加科目」の表で区分を確かめてください',
    ce_wp_rounding:
      '{name}：ワークペーパーの円未満の金額を四捨五入しました（動いた額 {r} 円は繰越利益剰余金に入っています）',
    ce_wp_err_prior_year:
      '✗ {name}：この年度には年初の残高がありますが、仕訳帳には年初の内訳がありません。前の年度のワークペーパーか、弥生会計の期首残高データを入れてください',
    ce_wp_err_no_journal:
      '✗ {name}：ワークペーパーですが、仕訳帳の表（科目・明細・借方・貸方の見出しがある表）が見つかりません',
    ce_wp_err_no_bs:
      '✗ {name}：ワークペーパーですが、貸借対照表の表が見つかりません（年度末の日と資産合計をそこから読みます）',
    ce_wp_err_start:
      '✗ {name}：ワークペーパーの年度末（{day}）の次の月が、会社の資料の「記帳を始める月」（{start}）と違います。どちらかを直してください',
    ce_z_workpaper:
      '△ {name}：年次の財務ワークペーパー（貸借対照表・仕訳帳の表があるもの）です。会社の資料ではないため保存していません。この道具はまだワークペーパーから読み込めません。期首残高は、その貸借対照表の期末残高を会社の資料の「期首残高」シートに写すか、弥生会計の期首残高データを入れてください。',
    ce_ev_attached: '照合先を決めました',
    ce_ans_credit_h: '誰が払ったか（貸方）',
    ce_ans_credit: '貸方の科目（立替なら 未払金）',
    ce_ans_err_credit: '貸方の科目を選んでください',
    ce_sg_same:
      '同じ摘要の明細 {n} 件を「{acc}」で仕訳済み（最近 {last}）——下書きに入れました。確かめて保存',
    ce_sg_similar:
      '同じ相手の明細 {n} 件（例：{desc}）を「{acc}」で仕訳済み（最近 {last}）——下書きに入れました。確かめて保存',
    ce_sg_far:
      '同じ相手の明細は「{acc}」で仕訳していますが、金額（以前 {amounts}）と大きく違うので下書きには入れていません。別の取引かもしれません',
    ce_sg_use: 'この科目で入れる',
    ce_sg_alts:
      '同じ摘要（相手）の明細は以前いくつかの科目で仕訳されていて、今回どれかは決められません。選んでください：',
    ce_chip_bank_short: '明細は {d} まで（月末は未照合）',
    ce_k_cash_short: '明細は {d} まで・月末残高は未照合',
    ce_fx_jm_mode: '住民税の特別徴収',
    ce_fx_opt_special: 'あり（決定通知書の月額を入れる）',
    ce_fx_opt_none: 'なし（普通徴収・前年の所得なし等）',
    ce_fx_from_month: '開始月（YYYY-MM、例 2026-06。翌 5 月まで同額）',
    ce_step_from: '締める期間：開始',
    ce_step_to: '終了',
    ce_fy_chip: '{y}年{m}月期（{from}〜{to}）',
    ce_period_latest: '最新の 1 か月だけ',
    ce_period_note:
      '決算月：{m} 月 ・ 帳簿の開始：{start}（期首残高はその前月末）・ 銀行明細：{last} まで',
    ce_months_h: '表示する月',
    ce_err_period: '締める期間に誤りがあります：',
    ce_p_save: '{m} の成果物を書き出し中…',
    ce_fs_out_month: '書き出し：{path}（ワークペーパー・報告書 2 件）',
    ce_fs_out_range: '書き出し：{root}/ の {a}〜{b}（{n} か月、各月にワークペーパーと報告書 2 件）',
    ce_fx_btn: 'ここで入力',
    ce_fx_amount: '月額',
    ce_fx_until_may: '同じ額を翌年 5 月まで入れる',
    ce_fx_mode: '通勤方法',
    ce_fx_opt_transit: '公共交通機関（定期）',
    ce_fx_opt_car: 'マイカー・自転車',
    ce_fx_pass_monthly: '1 か月の定期代',
    ce_fx_one_way_km: '片道の距離（km）',
    ce_fx_parking: '駐車場代／月（任意）',
    ce_fx_evidence: '根拠書類（例：2025 年 定時決定 決定通知書）',
    ce_fx_wages_koyou: '開始月より前に払った賃金（雇用保険の対象）',
    ce_fx_wages_rousai: '開始月より前に払った賃金（労災の対象）',
    ce_fx_estimate_paid: '前年度に申告・納付した概算保険料',
    ce_fx_withheld_employee: '前年度に給与から控除した雇用保険料',
    ce_fx_installment: '延納（3 回に分けて納付）',
    ce_fx_save: '保存（締め直すと資料に書き込む）',
    ce_fx_saved: '✓ 入力済み',
    ce_fx_err_required: '入力してください：{f}',
    ce_fx_err_num: '{f} は 0 以上の数で',
    ce_err_fix: '入力した内容に問題があります：',
    ce_fs_written: '{name} に書き込みました（元のファイルの控え：{path}）',
    ce_dl_file: '{name} をダウンロード',
    ce_dl_report: '{name}',
    ce_open_folder: '作業フォルダを選ぶ',
    ce_cl_h: '最近の会社',
    ce_cl_item: '{name}：{m} まで締め・対応が必要な事項 {n} 件',
    ce_cl_never: '{name}：まだ締めていません',
    ce_cl_open: '開く',
    ce_cl_forget: '一覧から外す',
    ce_reset: '最初からやり直す…',
    ce_reset_q:
      'このフォルダの {n} 個のファイルを {path} に移して、空のフォルダから始めます（消しません。戻すときはそこから元の場所へ）',
    ce_reset_go: '移して最初から',
    ce_reset_no: 'やめる',
    ce_reset_done: '{n} 個のファイルを {path} に移しました。空のフォルダから始められます',
    ce_reset_empty: '移すものはありません（もう空のフォルダです）',
    ce_reset_left:
      '移せなかったもの：{list}（Excel などで開いていませんか。閉じてからもう一度押してください）',
    ce_reset_err: '{name} を作れませんでした：{msg}',
    ce_cl_denied:
      '✗ {name}：フォルダを読み書きする許可がありませんでした。開き直すときは、許可を求める画面で「許可する」を押してください。',
    ce_cl_gone:
      '✗ {name}：フォルダが見つかりません（移動・削除・名前の変更のどれかです）。一覧から外して、もう一度フォルダを選んでください。',
    ce_cl_d:
      'この一覧はこのブラウザだけに保存されます（フォルダの中身は保存しません）。開くたびに、ブラウザが読み書きの許可を確認します。',
    ce_open_hint:
      'Chrome・Edge では、フォルダを直接読み書きできます：締めの結果と回答が自動でフォルダに保存されます（毎回、ブラウザが許可を確認します）。他のブラウザでは「フォルダを選ぶ」を使ってください（読み取りのみで、結果はダウンロードが必要です）。',
    ce_fs_connected: '接続済み：{name}（読み書き・{n} ファイル）',
    ce_fs_out: '保存しました：{path}',
    ce_fs_book: '回答を 会社資料.xlsx に書き込みました（元のファイルの控え：{path}）',
    ce_fs_dec: '回答を decisions.yaml に書き込みました（控え：{path}）',
    ce_fs_locked:
      'フォルダに書き込めません。Excel で 会社資料.xlsx を開いていませんか？閉じてから「回答を反映して締め直す」を押してください（回答は消えていません）。',
    ce_fs_err: 'フォルダに書き込めませんでした：{msg}',
    ce_chip_bank_ok: '銀行と帳簿は一致',
    ce_chip_bank_ng: '銀行と帳簿が不一致',
    ce_chip_sus: '暫記 {n} 件・{v}（確認後に数字が変わることがあります）',
    ce_asof: '{d} 現在',
    ce_k_rev: '今月の売上',
    ce_k_profit: '今月の利益',
    ce_k_cash: '月末の預金',
    ce_k_items: '対応が必要',
    ce_k_ytd: '{f} からの累計 {v}',
    ce_k_cash_ok: '＝銀行の月末残高',
    ce_k_cash_ng: '≠銀行の月末残高',
    ce_k_cash_diff: '≠銀行の月末残高（帳簿の方が {d}）',
    ce_b_info: 'お知らせ',
    ce_lead_info:
      '計算の前提のお知らせです。誤りでも不足でもありません。一度読んで、関係がなければ「回答」→ 処理済みにすると、次からは出ません。',
    ce_ev_date_hint:
      '「取引日」には書類に書いてある日付を入れます：領収書は領収日、請求書は請求日（発行日）、口座振替の通知は引落日。',
    ce_ev_linked_auto: '{d} {t}（自動で照合）',
    ce_k_counts: '要確認 {ask}・要対応 {todo}・誤りの疑い {err}（ほかにお知らせ {info}）',
    ce_up_h: 'これから納めるもの',
    ce_up_note_open:
      'まだ済んでいない事項があります。それを片付けると、ここの金額は変わることがあります。',
    ce_up_note: '月末残高からの見積り。告知書・納付書の金額で確認してください。',
    ce_up_shaho: '{m} 分の社会保険料',
    ce_up_gensen: '源泉所得税',
    ce_up_jumin: '住民税',
    ce_up_tokurei: '（納期の特例）',
    ce_up_none: 'ありません',
    ce_out_h: '締めの成果物',
    ce_bs_h: '貸借対照表',
    ce_pl_h: '損益計算書',
    ce_pl_month: '今月',
    ce_pl_ytd: '期首から',
    ce_sr_h: '仕訳を探す（年度をまたいで）',
    ce_sr_d:
      '確定した年度と、いま締めた期間の仕訳から探します。科目を入れると、その科目の元帳として残高も出します。',
    ce_sr_acc: '科目',
    ce_sr_sub: '補助',
    ce_sr_text: '摘要などの文字',
    ce_sr_from: '日付：から',
    ce_sr_to: 'まで',
    ce_sr_amount: '金額',
    ce_sr_go: '探す',
    ce_sr_count: '{total} 件のうち {n} 件を表示しています。',
    ce_sr_none: '見つかりませんでした。',
    ce_sr_closed: '確定済み（{y} 期）',
    ce_sr_date: '日付',
    ce_sr_vno: '伝票',
    ce_sr_narr: '摘要',
    ce_sr_line: '科目',
    ce_sr_dr: '借方',
    ce_sr_cr: '貸方',
    ce_sr_bal: '残高',
    ce_sr_err: '✗ 先に締めを実行してください。',
    ce_pl_settle: '決算整理',
    ce_pl_settle_note:
      '決算整理の仕訳は、決算月の「今月」に含めず別の欄に出しています。「期首から」には含みます。',
    ce_bs_assets: '資産合計',
    ce_bs_le: '負債・純資産合計',
    ce_pl_net: '当期純損益',
    ce_sec_ca: '流動資産',
    ce_sec_ppe: '有形固定資産',
    ce_sec_intan: '無形固定資産',
    ce_sec_inv: '投資その他の資産',
    ce_sec_cl: '流動負債',
    ce_sec_ncl: '固定負債',
    ce_sec_eq: '純資産',
    ce_sec_sales: '売上高',
    ce_sec_cogs: '売上原価',
    ce_sec_sga: '販売費及び一般管理費',
    ce_sec_noi: '営業外収益',
    ce_sec_noe: '営業外費用',
    ce_sec_ei: '特別利益',
    ce_sec_el: '特別損失',
    ce_sec_tax: '法人税等',
    ce_sec_other: 'その他',
    ce_items_h: '対応が必要な事項',
    ce_b_ask: '要確認',
    ce_b_todo: '要対応',
    ce_b_err: '誤りの疑い',
    ce_lead_ask:
      '帳簿にはいったん記録済み。性質や前提を確認してください。確認して締め直すと数字が確定します。',
    ce_lead_todo: '資料が足りない、またはまだ済んでいないこと。入れたら締め直してください。',
    ce_lead_err:
      '数字どうしが合いません。資料か帳簿の誤りの可能性が高いので、分析を見て処理を選んでください。',
    ce_an: '分析',
    ce_sug: '提案',
    ce_items_none: 'この分類の事項はありません。',
    ce_check_item: '検査 {id}：',
    ce_acct_h: '会計担当者向け：全検査の明細',
    ce_next_h: '次にすること',
    ce_next_contact:
      'エンジン内部の検査 {n} 項目（{ids}）が通りません。ワークペーパーを添えて連絡してください',
    ce_next_checks:
      'まず通らなかった検査 {n} 項目（{ids}）を片付けてください。やり方は各行の「→」にあります',
    ce_next_answer: 'この画面の「回答」で済む要確認 {n} 件',
    ce_next_both: '「回答」でも表の修正でも済む要確認 {n} 件（各行の説明を参照）',
    ce_next_sheet: '表を直してから締め直す要確認 {n} 件',
    ce_next_sheets: '開く表：{list}（YAML なら {files}）',
    ce_next_none: 'やることはありません。ワークペーパーをダウンロードして確認してください',
    ce_how_answer: 'この画面で回答',
    ce_how_sheet: '表を直す',
    ce_how_both: '回答／表',
    ce_how_contact: '連絡',
    ce_files_intro:
      'まず作業フォルダを 1 つ選びます（空のフォルダでかまいません）。次に、下の 2 つの入口に資料を入れます。中身を見て、こちらで仕分けてフォルダに保存します。決算の結果と回答も同じフォルダに保存されます。',
    ce_tpl_xlsx: '空のテンプレートをダウンロード',
    ce_tpl_yaml: '上級者向け：YAML テンプレート',
    ce_wb_sheets: 'Excel の表：',
    ce_fd_decisions:
      '締めたあと、この画面の「回答」ボタンで答えれば済みます（Excel の「回答」表に書き戻せます）',
    ce_col_answer: '回答',
    ce_ans_intro:
      '各行の「回答」から入力し、「回答を反映して締め直す」を押してください。回答は判断記録（判断者・日付・理由）として残ります。',
    ce_ans_btn: '回答',
    ce_ans_edit: '修正',
    ce_ans_saved: '✓ 回答済み',
    ce_ans_action: '処理',
    ce_ans_book: '仕訳する',
    ce_ans_done: '処理済み（仕訳しない）',
    ce_ans_account: '科目を選ぶ',
    ce_ans_sub: '補助（任意）',
    ce_ans_tax: '税区分：科目の既定どおり',
    ce_ans_neg:
      '差し引かれた分はマイナスで書きます。例：報酬の支払 89,790 ＝ 支払報酬 100,000 ＋ 預り金 −10,210（天引きした源泉所得税）。入金 329,560 ＝ 売掛金 330,000 ＋ 支払手数料 −440（相手が差し引いた手数料）。',
    ce_ans_split: '＋ 行を分ける',
    ce_ans_remove: '削除',
    ce_ans_diff: '残り {n} 円',
    ce_ans_evidence: '根拠書類',
    ce_ans_reason: '理由',
    ce_ans_by: '判断者',
    ce_ans_paid_on: '納付日（明細に無い納付）',
    ce_ans_paid_on_hint: '実際に納めた日。期限を過ぎたかどうかを確かめます',
    ce_ans_paid_on_pick: '理由に {d} とあります。納付日に入れます',
    ce_ans_at: '判断日 {d}',
    ce_ans_save: '回答を保存',
    ce_ans_cancel: 'キャンセル',
    ce_ans_err_by: '判断者を入力してください',
    ce_ans_err_account: '科目を選んでください',
    ce_ans_err_sum: '各行の金額の合計が明細の金額と一致しません',
    ce_ans_err_reason: '理由を書いてください',
    ce_rerun: '回答を反映して締め直す（{n} 件）',
    ce_dl_book: '回答入りの会社資料.xlsx をダウンロード',
    ce_dl_decisions: '回答ファイル（decisions.yaml）をダウンロード',
    ce_dl_note: '次回はこのファイルでフォルダを差し替えれば、回答を入れ直す必要はありません。',
    ce_adv_yaml: '上級：YAML の回答テンプレート',
    ce_page_title: '月次決算エンジン — 千里同風',
    ce_title: '月次決算エンジン（日本・試用版）',
    ce_subtitle: '給与 · 社会保険 · 源泉 · 銀行照合 · 消費税 → ワークペーパー',
    ce_logout: 'ログアウト',
    ce_stance_title: '判断するのは人、確かめるのは道具。',
    ce_stance_body:
      '帳簿をつけるところは、いまの会計ソフトや AI が手伝ってくれます。この道具が受け持つのは、そのあとの月末のひと仕事です。給与・社会保険・税金・銀行残高を一つずつ突き合わせ、合わないところを理由と一緒にお知らせします。',
    ce_stance_a: '推測で埋めません。分からないことは分からないと言って、お尋ねします。',
    ce_stance_b:
      'どの数字にも、どこから来たか（法令・料率表・入力した行）をたどれる道筋を付けます。',
    ce_stance_c:
      '財務データはこのブラウザの外に出ません。締めた仕訳は、お使いの会計ソフトへ持っていけます。',
    ce_stance_tail: '「技術は人のためにある」——千里同風の考えです。',
    ce_yayoi_note:
      '「弥生会計インポート」は、締めた月の仕訳を弥生会計に取り込める形（弥生インポート形式）にしたファイルです。弥生会計の［ファイル］→［インポート］で読み込みます。科目の名前が弥生の登録名と違うときは、取り込みの画面で対応づけを尋ねられます。',
    ce_yayoi_open_note:
      '「弥生会計期首残高」は、記帳を始めた月の期首残高を弥生会計に取り込める形にしたファイルです。弥生会計の［科目残高入力］を開き、［ファイル］→［インポート］で読み込みます。繰越利益剰余金は入れていません（弥生会計では直接入力できない科目です）。取り込んだあと［貸借調整］を押すと弥生会計が計算します。その額がこの道具の期首残高の繰越利益剰余金と同じなら、残高はすべて移っています。',
    ce_cy_h: '年度の確定',
    ce_cy_d:
      '申告を済ませた年度を確定します。確定した年度の数字は、そのあと変わりません。誤りが見つかったら、当期に更正の仕訳を入れて直します。確定すると作業フォルダの closed フォルダに確定ファイルができ、次からの締めは次の年度の初めから計算します。',
    ce_cy_by: '判断者',
    ce_cy_go: '{m} 期を確定する',
    ce_cy_ok: '✓ {end} 期を確定しました（仕訳 {n} 件）。次からの締めは {next} から計算します。',
    ce_cy_err_open:
      '✗ この年度に、まだ済んでいない事項があります。片付けてから確定してください：{items}',
    ce_cy_err_checks: '✗ 検査に通っていない月があります（{months}）。直してから確定してください。',
    ce_cy_err_not_closed: '✗ 年度の最初の月から年度末まで締めてから、確定してください。',
    ce_cy_err_already: '✗ この年度はもう確定しています。',
    ce_cy_err_by: '✗ 判断者を入れてください。',
    ce_cy_err_other: '✗ 確定できませんでした（{msg}）。',
    ce_cy_closed: '確定済みの年度：{list}。締めはその次の年度の初めから計算します。',
    ce_cy_item: '{end} 期（{by}・{at}）',
    ce_lr_h: '弥生の仕訳から見つけた銀行ルールの候補',
    ce_lr_h_dict: 'よくある摘要から見つけた銀行ルールの候補',
    ce_lr_sum_dict:
      '銀行明細のうち {n} 行が、どの会社でも意味の決まる摘要（振込手数料・預金利息・家賃・光熱費・通信費）でした',
    ce_lr_d_dict:
      '組み込みの辞書から出した候補で、この会社の過去の記帳ではありません。会社の資料に入れるのは、チェックを付けたものだけです。税務署・市役所・法務局・個人名への振込などは意味が一つに決まらないので、候補にせず一行ずつ聞きます。',
    ce_lr_sum:
      '{name}：仕訳 {v} 件（{from}〜{to}）。そのうち {p} 件を、銀行明細と日付・金額で組めました。同じ摘要の明細が 2 件以上、すべて同じ科目に記帳されていたものを候補にしています。',
    ce_lr_d:
      '候補は候補です。会社の資料に入れるのは、チェックを付けたものだけです。給与・社会保険・税金の支払は、締めが計算から照合するので候補にしていません。',
    ce_lr_inn: '入金',
    ce_lr_out: '出金',
    ce_lr_n: '{n} 件',
    ce_lr_none:
      '新しく足せる候補はありません（同じ摘要のルールがもうあるか、2 件以上そろった摘要がありません）。',
    ce_lr_split_h: '過去の記帳で科目が割れているため、候補にしなかった摘要',
    ce_lr_unknown_h: '科目表に無い科目（「追加科目」に登録すると、その科目の候補も入れられます）',
    ce_lr_unknown_mark: '科目表に無い科目',
    ce_lr_by: '判断者',
    ce_lr_go: '選んだルールを会社の資料に入れる',
    ce_lr_ok: '✓ 銀行ルールを {n} 本、会社の資料に入れました（前のファイル：{path}）',
    ce_lr_err_by: '✗ 判断者を入れてください。',
    ce_lr_err_empty: '✗ 入れられる候補が選ばれていません。',
    ce_lr_err_no_bank:
      '✗ {name}：弥生の仕訳ですが、同じ期間の銀行明細がフォルダにありません。先に銀行明細を入れてから、もう一度入れてください。',
    ce_lr_err_no_book:
      '✗ {name}：弥生の仕訳ですが、会社の資料がまだありません。先に会社の資料を入れてください。',
    ce_lr_err_file: '✗ {name}：{line} 行目が弥生インポート形式ではありません。',
    ce_pv_title: 'この回答でできる仕訳',
    ce_pv_debit: '借方',
    ce_pv_credit: '貸方',
    ce_pv_wait: '科目と金額がそろうと、ここに仕訳が出ます。',
    ce_privacy:
      '財務データはこのブラウザの中だけで処理され、サーバーには送信されません。読み込むのは実行環境とエンジン本体だけです。',
    ce_optional: '任意',
    ce_z_tab_t: '表（Excel・CSV）',
    ce_z_tab_d:
      '会社の資料、銀行明細、弥生会計の期首残高・仕訳。ここにドラッグするか、「ファイルを選ぶ」を押してください。',
    ce_z_ev_t: '証憑（写真・PDF）',
    ce_z_ev_d:
      '領収書・請求書・納付書など。このパソコンの中で日付・金額・取引先を読み取ります（画像は外に送りません）。',
    ce_z_pick: 'ファイルを選ぶ',
    ce_z_need_folder:
      '先に作業フォルダを選ぶと、2 つの入口が使えるようになります（保存先が必要なため）。',
    ce_z_looking: '確認中：{name}',
    ce_z_wb_ok: '✓ {name} → 会社の資料（会社資料.xlsx）',
    ce_z_wb_replaced: '✓ {name} → 会社の資料を入れ替えました（前のファイル：{path}）',
    ce_z_bank_ok: '✓ {name} → 銀行明細（bank フォルダ）',
    ce_z_bank_unchecked:
      '✓ {name} → 銀行明細（bank フォルダ）。会社の資料に銀行口座がまだ登録されていないので、列名は照らしていません（登録すると次の確認で照らします）',
    ce_ev_helper_denied:
      'ブラウザがこのページから本機の読み取り助手へつなぐのを止めています。アドレスバー左のアイコン →「このサイトのアクセス許可」で「ローカル ネットワーク アクセス」（このデバイス上のアプリ）を「許可」にして、ページを読み込み直してください。今回はブラウザの中で 1 ページ目だけ読みます',
    ce_ev_helper_ask:
      'ブラウザが「このデバイス上の他のアプリへのアクセス」を許可するか尋ねています。「許可」を押してください（本機の読み取り助手につなぐためです。最大 60 秒待ちます）',
    ce_bk_cols:
      '{name}：日付・摘要・出金・入金・残高の列を見出しから見分けられませんでした。会社の資料の「銀行口座」の表に列名を書いてください',
    ce_bk_chain:
      '{name}：見出しから当てた列で読むと、残高が {n} か所つながりません。列の当て違いかもしれないので登録していません。会社の資料の「銀行口座」の表に列名を書いてください',
    ce_bk_choose:
      '{name}：期首残高に預金の行がいくつもあり（{list}）、どの口座の明細か決められません。会社の資料の「銀行口座」の表に登録してください',
    ce_bk_open_ng:
      '{name}：明細の最初の取引の前の残高は {before} 円、期首残高は {opening} 円で合いません。明細が期首から始まっているか、期首残高を確かめてください',
    ce_bk_open_ok: '{name}：明細の最初の取引の前の残高 {before} 円が、期首残高と一致しました',
    ce_bk_ok:
      '✓ {name}：会社の資料に銀行口座「{acct}」を登録しました（列：日付・摘要・出金・入金・残高＝{cols}。{n} 件 {from}〜{to}、残高は前後つながっています）。前のブックは {path} に控えました',
    ce_z_bank_nobook:
      '✓ {name} → 銀行明細（bank フォルダ）。会社の資料がまだ無いので、列名は未確認です',
    ce_z_bank_other:
      '✗ {name}：銀行明細のようですが、見出し（{found}）が、会社の資料の「銀行口座」シートに登録した列名（{want}）と違います。登録の列名をファイルの書き方に合わせてから、もう一度入れてください',
    ce_z_unknown:
      '✗ {name}：会社の資料でも、銀行明細でも、弥生会計の期首残高データでもないため、保存していません',
    ce_z_op_ok:
      '✓ {name} → 会社の資料の「期首残高」シートに {n} 行を入れました（前のファイル：{path}）',
    ce_z_op_retained:
      '{name}：繰越利益剰余金 {amount} 円は、貸借の差額から入れました（弥生会計の［貸借調整］と同じ計算です）。前期の貸借対照表と合っているか確かめてください',
    ce_z_op_names:
      '{name}：科目表に無い科目名があります（{list}）。「期首残高」シートで名前を直すか、「追加科目」シートに足してください',
    ce_z_op_no_book:
      '✗ {name}：弥生会計の期首残高データですが、会社の資料がまだありません。先に会社の資料（記帳を始める月・決算月）を入れてください',
    ce_z_op_exists:
      '✗ {name}：期首残高はもう {n} 行入っています。上書きはしません。入れ直すときは、会社の資料の「期首残高」シートを空にしてから、もう一度入れてください',
    ce_z_op_start:
      '✗ {name}：このファイルの期首日（{day}）が、会社の資料の「記帳を始める月」（{start}）の初日ではありません。どちらかを直してください',
    ce_z_op_file:
      '✗ {name}：{line} 行目が弥生会計の期首残高データの形ではありません（期首日・勘定科目名・貸借区分・補助科目名・部門・前期繰越残高の順です）',
    ce_z_op_book: '✗ {name}：会社の資料に直すところがあるため、取り込めません（{msg}）',
    ce_z_op_yaml: '✗ {name}：この会社フォルダは YAML で入力しているため、取り込めません',
    ce_z_err: '✗ {name}：読めませんでした（{msg}）',
    ce_z_skip: '✗ {name}：この種類のファイルは扱えません（表は Excel・CSV、証憑は画像・PDF）',
    ce_ev_generic:
      '書類の「{key}」の欄から読みました。この種類の書類は検算できないので、原本と照らしてから確認してください',
    ce_ev_generic_nokey:
      '書類の言葉から読みました。この種類の書類は検算できないので、原本と照らしてから確認してください',
    ce_ev_no_template:
      'この種類の書類はまだ自動で読めません。ファイル名を押して原本を開き、見ながら取引日・金額・取引先を入れてください',
    ce_ev_fx_ask:
      '外貨の書類です（{cur} {amt}）。円に換算した金額を入れてください。使ったレートを備考に書いておくと、あとで確かめられます。',
    ce_ev_fx_rounded:
      '外貨の書類です（{cur} {amt}）。書類に書いてある換算 {amt} × {rate} ＝ {yen} の円未満を四捨五入して、金額に入れました。確かめてください。',
    ce_ev_fx_used:
      '外貨の書類です（{cur} {amt}）。書類に書いてある換算 {amt} × {rate} ＝ {yen} を金額に入れました。確かめてください。',
    ce_ev_fx_unread:
      '外貨（{cur}）の書類のようですが、金額を読み切れませんでした。書類を見て、円に換算した金額を入れてください。',
    ce_ev_open: '原本を開く：{name}',
    ce_ev_open_err: '原本を開けませんでした（{msg}）',
    ce_fix_where:
      '「表を直す」は、作業フォルダ（さきほど選んだ「{name}」フォルダ）の中の「会社資料.xlsx」を直すことです（元の置き場所のファイルではありません）。Excel で直して保存し、Excel を閉じてから「締めを実行」を押してください。明細を足すときは、上の「表」の入口に入れます。',
    ce_ev_by_label:
      '判断者（このパソコンに記憶します。証憑の確認・質問への回答・銀行ルール・年度の確定に記録されます）',
    ce_rerun_note:
      '作業フォルダにつないでいるときは、回答をフォルダの「会社資料.xlsx」に書き込みます（元のファイルは先に「締め結果/バックアップ」へコピーします）。',
    ce_period_why:
      '帳簿は開始月から順に締めていくので、既定では会計年度の最初の月から「終了」の月まで計算します。結果は月ごとに切り替えて見られます。1 か月だけでよければ「最新の 1 か月だけ」を押してください。',
    ce_ev_box: '証憑の一覧と確認',
    ce_ev_count: '{n} 件（未確認 {d} 件）',
    ce_ev_count_none: 'まだありません',
    ce_ev_col_kind: '区分',
    ce_ev_basis_photo: '画像ファイル → 仮に「紙」',
    ce_ev_basis_scan: '文字の無いスキャン PDF → 仮に「紙」',
    ce_ev_basis_text: '文字の入った PDF → 仮に「電子」',
    ce_ev_basis_vector: 'ソフトで作られた PDF → 仮に「電子」',
    ce_how_h: '入れ方（クリックで拡大）',
    ce_how_1: '月末。資料があちこちに散らばっています',
    ce_how_2: '表は 1 か所に：会社の資料と銀行明細',
    ce_how_3: '写真と PDF も 1 か所に：領収書・請求書',
    ce_how_4: 'フォルダを選べば、決算の結果が出てきます',
    ce_how_prev: '前へ',
    ce_how_next: '次へ',
    ce_close: '閉じる',
    ce_step_files: '作業フォルダを選び、資料を入れる',
    ce_col_file: 'ファイル',
    ce_col_need: '必要なとき',
    ce_col_state: '状態',
    ce_f_company: '会社の基本情報と方針',
    ce_fd_company:
      '都道府県・決算月・開始月、社保などの方針 9 項目、消費税の区分、銀行口座。判断には判断者と日付を書きます',
    ce_f_employees: '従業員名簿',
    ce_fd_employees: '生年月日・入社日・標準報酬月額・扶養人数・住民税の月額・固定給',
    ce_f_opening: '期首残高',
    ce_fd_opening: '開始月の前月末の試算表（前の会計ソフトから転記）',
    ce_f_bank: '銀行明細',
    ce_fd_bank:
      'ネットバンキングのダウンロードをそのまま（CSV・Excel どちらも可）。締める月の月末まで',
    ce_f_monthly: '毎月の給与の変動・請求',
    ce_fd_monthly:
      'payroll.yaml（残業・時給など名簿と違う分）、sales.yaml（請求書）。無ければ名簿の固定給で計算',
    ce_f_bank_rules: '銀行明細のルール',
    ce_fd_bank_rules: '家賃・手数料など毎月の明細の科目を一度書けば自動で仕訳',
    ce_f_fixed_assets: '固定資産台帳',
    ce_fd_fixed_assets: '毎月の減価償却を計算',
    ce_f_decisions: '要確認への回答',
    ce_f_adjustments: '調整仕訳',
    ce_fd_adjustments: '銀行を通らない取引・按分・決算整理（判断者と日付つき）',
    ce_f_labor_insurance: '労働保険の年度更新',
    ce_fd_labor_insurance: '6〜7 月：開始前の賃金・前年度の概算保険料など',
    ce_f_corporate_tax: '法人税等の計算表',
    ce_fd_corporate_tax: '決算月：申告調整・繰越欠損金・中間納付など',
    ce_need_required: '必須',
    ce_need_monthly: '毎月',
    ce_need_optional: '任意',
    ce_need_season: '6〜7月',
    ce_need_year_end: '決算月',
    ce_s_wait: '未確認',
    ce_s_ok: '✓ あり',
    ce_s_missing: '✗ 不足',
    ce_s_gaps: '⚠ 未設定 {n} 項目（下の一覧）',
    ce_s_error: '✗ 書式の誤り',
    ce_s_absent: '— なし',
    ce_s_warn: '⚠ 今月は必要',
    ce_pick_folder: '作業フォルダを選ぶ',
    ce_upload_none: 'フォルダが選ばれていません',
    ce_upload_count: '{n} ファイルを選択済み',
    ce_upload_hint:
      '事務所の既定方針（office）を使う場合は、そのファイルもフォルダの中に置いてください。ファイルはこのブラウザの中だけで読みます。',
    ce_pre_running: 'ファイルを確認しています…',
    ce_pre_ok_warn:
      '締めを実行できます。ただし ⚠ の付いた項目があります。先に上の入口と「項目ごとの確認結果」を見てください。',
    ce_pre_ok: 'ファイルはそろっています。締めを実行できます。',
    ce_pre_block:
      '不足または書式の誤りがあります。上の一覧に沿って補ってください：ファイルは下の入口に入れれば、自動でもう一度確認します（フォルダの中のファイルを直接直したときは、フォルダを選び直してください）。',
    ce_gaps_recheck: '書いたので、もう一度確認',
    ce_gaps_lead_qa:
      'まだ決まっていない設定が {n} 項目あります。ここで答えて「答えを保存」を押すと「{book}」に書き込みます（前のファイルは控えを残します。判断者と日付も自動で記録）。一部だけ答えて保存してもかまいません。Excel で直接書いたときは「書いたので、もう一度確認」',
    ce_gaps_save: '答えを保存',
    ce_gaps_pick: '— 選んでください —',
    ce_gaps_none: 'まだ何も答えていません',
    ce_ev_staff_added:
      '勤務時間集計表の {names} を従業員の表に加えました（元の会社資料のバックアップ：{path}）。区分・生年月日などは上の質問に答えてください。',
    ce_gaps_saved:
      '{n} 項目の答えを会社資料に書き込みました（前のファイルの控え：{path}）。もう一度確認しています…',
    ce_gaps_bad: '書けない答えがあります（会社資料は変えていません）：{list}',
    ce_gaps_choices: '（選ぶ：{list}）',
    ce_gaps_sheet: '表「{sheet}」',
    ce_gaps_lead:
      'フォルダの「{book}」を Excel で開き、次の {n} 項目を埋めてください。「方針」の表は、選んだ欄の右の「判断者」「日付」も書きます。保存したら「書いたので、もう一度確認」を押してください。',
    ce_pre_gaps: '会社の資料に、まだ決めていない設定があります（下の一覧）。',
    ce_pre_engine_err: 'エンジンが読み込みで問題を見つけました：',
    ce_step_run: '締める',
    ce_step_month: '締める月',
    ce_step_lang: 'ワークペーパーの言語',
    ce_lang_zh: '中国語',
    ce_lang_ja: '日本語',
    ce_run: '締めを実行',
    ce_p_runtime: '実行環境をダウンロード中（初回のみ・10〜20 秒）',
    ce_p_packages: '部品を読み込み中',
    ce_p_engine: 'エンジンを準備中',
    ce_p_ready: '締めを開始',
    ce_p_month: '{label} を締めています（{i}/{n} か月）',
    ce_p_workpaper: 'ワークペーパーを作成中',
    ce_p_elapsed: '{n} 秒経過',
    ce_p_note:
      '計算はバックグラウンドで行うので画面は固まりません。このページは閉じないでください。',
    ce_disclaimer:
      '会計担当者の判断を前提とした補助ツールです。法人税等の計算表は概算で、申告書ではありません。',
    ce_status_done: '完了',
    ce_err_auth:
      'エンジンを読み込めませんでした。ログインし直してから、もう一度お試しください（エンジンはログインした会員だけが使えます）。',
    ce_err_bundle:
      'エンジンのファイルが壊れているか、更新の途中です。ページを再読み込みしてください。',
    ce_err_load:
      '実行環境を読み込めませんでした。ネットワーク、または広告ブロックなどの拡張機能を確認してから再読み込みしてください。',
    ce_err_no_company:
      'このフォルダにはまだ会社の資料がありません。下の「表」の入口に「会社資料.xlsx」を入れてください（すでに資料を入れたフォルダがあるなら、そのフォルダを選び直してください。1 つ上のフォルダや bank フォルダではありません）。',
    ce_err_no_month: '月を選んでください。',
    ce_err_company: '会社データに問題があります：',
    ce_err_close: '締め処理が止まりました：',
    ce_err_runtime: '予期しないエラー：',
    ce_summary: '{pass}/{n} 通過・失敗 {fail}・未検査 {skip}・対象外 {na}',
    ce_download: 'ワークペーパー（xlsx）をダウンロード',
    ce_checks: '検査結果',
    ce_col_id: '番号',
    ce_col_check: '検査',
    ce_col_status: '結果',
    ce_col_n: '件数',
    ce_st_pass: '通過',
    ce_st_fail: '失敗',
    ce_st_skip: '未検査',
    ce_na: '対象外',
    ce_pending: '要確認（{n} 件）',
    ce_col_qid: '番号',
    ce_col_cat: '区分',
    ce_col_item: '事項',
    ce_col_date: '日付',
    ce_col_amount: '金額',
    ce_answers: '回答テンプレート（decisions.yaml に追記）',
    ce_answers_none: '未照合の銀行明細はありません。',
    ce_copy: 'コピー',
    ce_copied: 'コピーしました',
    ce_sample_line: 'まず結果の例を見る：',
    ce_sample_tokyo: '東京の架空会社',
    ce_sample_osaka: '大阪の架空会社',
    ce_sample_banner: 'これは架空の会社のサンプルの結果です（実在の会社とは関係ありません）。',
    closing_title: '月次決算エンジン（日本）',
    closing_one:
      '給与・社保・源泉・銀行照合・消費税を締め、検査結果つきのワークペーパーを出力。データはブラウザから出ません。',
    closing_cta: 'エンジンを開く',

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
    an_sections_info: '{n} 個のセクション · {sel} 個を選択 · 約 {chars} 文字',
    an_chars: '{chars} 文字',
    an_chars_sel: '{sel} / {total} 文字',
    an_file_reading: '読み込み中…',
    an_file_error: 'エラー',
    an_file_scanned: '0 文字 — スキャンした PDF かもしれません',
    an_remove_title: '削除',
    an_drop_more: 'クリックして追加',
    an_skip_limit: 'ファイル数の上限は {max} 件です。追加されなかったファイル：{list}',
    an_skip_type: '対応していない形式です：{list}',
    an_skip_dup: '同じ名前のファイルはすでに追加されています：{list}',
    an_err_local: 'ローカル環境では動作しません。デプロイ後にお試しください。',
    an_err_empty: '分析結果が空でした。',
    an_err_server: 'サーバーエラー（HTTP {status}）',
    an_err_server_hint: 'ファイルを減らすか、質問を分けてお試しください。',
    an_err_fallback: '（画像解析に失敗したためテキスト解析で再試行しましたが、それも失敗しました）',
    an_round: '**ラウンド {round}/{max}** · {note}',
    an_reading_pages: '読み込み中：{pages}',
  },

  zh: {
    nav_about: '关于我们',
    nav_team: '团队',
    nav_milestones: '大事记',
    nav_solutions: '解决方案',
    nav_products: '产品',
    nav_demo: '应用',
    nav_blog: '博客',

    hero_corp: '千里同風株式会社',
    home_page_title: '千里同風株式会社 — 让 AI 真正用到日常工作里（大阪）',
    hero_tagline: '人类对AI陪伴的一切渴望，不过是对灵魂共鸣的向往。',

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
    val1_desc:
      '脚踏实地的规划与执行。在追求理想的同时，诚实地寻求可实现的路径。所以我们先用在线工具把 AI 真正用到日常工作里，再走向嵌入 AI 的硬件。',
    val2_name: '清晰',
    val2_desc:
      '将复杂的技术转化为每个人都能理解的语言与形式。清晰的沟通是信任的基础。AI 做了什么、数据会去哪里，我们都会讲清楚。',
    val3_name: '责任',
    val3_desc:
      '拥有技术力量的人，对其使用方式负责。我们致力于AI的伦理化应用。最后的判断交给使用的人，结果始终以人能核对的形式交付。',

    showcase_eyebrow: '产品与方案',
    showcase_title: '让想象，成为现实。',
    showcase_lead: '从数字助手到实体陪伴，探索 AI 在真实场景中的更多可能。',
    showcase_app_tag: '应用方案',
    showcase_app_desc: 'AI 读取 PDF・Excel 订单，自动整理成受注台账。无需注册即可免费试用。',
    showcase_hw_tag: '产品',
    showcase_hw_desc: '将生成式 AI 融入玩具、教具与 IoT 设备，打造陪伴日常的产品，现正开发中。',
    showcase_more: '查看全部产品与方案',
    journal_eyebrow: '博客',
    journal_title: '记录探索，分享思考。',
    journal_lead: '关于技术、产品，以及人与 AI 之间正在发生的变化。',
    journal1_tag: 'Perspectives',
    journal1_name: '观点与观察',
    journal1_desc: '关于 AI、社会与未来关系的思考。',
    journal2_tag: 'Building',
    journal2_name: '研发手记',
    journal2_desc: '从概念、实验到产品落地的真实记录。',
    journal3_tag: 'Updates',
    journal3_name: '公司动态',
    journal3_desc: '项目进展、合作消息与公司的日常。',
    journal_more: '阅读全部文章',
    about_teaser_eyebrow: '关于我们',
    about_teaser_title: '从大阪出发，探索连接人与AI的新形式。',
    about_teaser_body:
      '千里同風株式会社以大阪为据点，致力于 AI 的研究与落地。现阶段提供在线 AI 工具和业务自动化，在此之上推进嵌入生成式 AI 的硬件开发。',
    about_teaser_cta: '了解团队',

    nav_member: '会员',
    demo_member_badge: '会员专属',

    footer_tagline: '人类对AI陪伴的一切渴望，不过是对灵魂共鸣的向往。',
    footer_nav_heading: '导航',
    footer_contact_heading: '联系方式',
    nav_privacy: '隐私政策',
    nav_consult: '免费咨询',
    nav_company: '公司概况',
    contact_page_title: '免费咨询・联系我们',
    contact_eyebrow: '联系我们',
    contact_title: '免费咨询',
    contact_lead:
      'AI 的应用、业务自动化、工具使用上的疑问等，内容不限，欢迎随时咨询。我们会在 1 个工作日内回复，不收费。',
    contact_mail_pre: '也可以直接发邮件：',
    footer_copy: '© 2025 千里同風株式会社',
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

    company_page_title: '千里同風株式会社 — 公司概况',
    company_eyebrow: '公司概况',
    company_title: '公司概况',
    co_name_h: '公司名称',
    co_name_v: '千里同風株式会社',
    co_est_h: '成立',
    co_rep_h: '代表人',
    co_rep_v: '代表董事　南 雪',
    co_addr_h: '地址',
    co_addr_v: '〒532-0006 日本大阪府大阪市淀川区西三国4丁目4-9-7',
    co_biz_h: '业务内容',
    co_biz1: 'AI 技术的研究、调研与信息提供',
    co_biz2: '运用 AI 的业务改善与效率化咨询、云服务提供',
    co_biz3: '软件与硬件的企划开发、销售',
    co_biz4: '受托市场调研、经营咨询',
    co_contact_h: '联系方式',
    co_contact_cta: '免费咨询表单',
    milestones_page_title: '千里同風株式会社 — 大事记',
    milestones_eyebrow: '大事记',
    milestones_title: '公司历程',
    milestones_body: '了解千里同風株式会社从成立至今的发展历程。',
    ms1_event: '千里同風株式会社 成立',
    ms1_desc: '于大阪市成立。以 AI 研究，以及嵌入 AI 的产品与服务企划为业务正式启动。',
    ms2_event: '官方网站上线',
    ms2_desc: '官方网站上线，同时发布第一个 AI 工具「中日翻译」。',
    ms3_event: '在线 AI 工具陆续上线',
    ms3_desc: '陆续上线文书分析、人生访谈、日语动词活用、招标信息监控、中文稿件校对。',
    ms4_event: '受发注自动化 演示上线',
    ms4_desc: '面向中小企业的业务自动化起步：用 AI 把订单整理成受注台账。',

    solutions_page_title: '千里同風株式会社 — 解决方案',
    solutions_eyebrow: '解决方案',
    solutions_title: '产品与服务',
    // ── 受発注→受注台帳 落地页（lead-gen Stage A）──
    o2l_page_title: '受发注自动化',
    o2l_card_title: '受发注 · Excel 自动化',
    o2l_card_desc: '上传订单（PDF / Excel），AI 整形成受注台账。先免费试用。',
    o2l_card_cta: '试试看',
    o2l_eyebrow: '受发注自动化',
    o2l_hero_title: '订单还在手工录入吗？',
    o2l_hero_lead: 'PDF、Excel 的订单，AI 自动转成受注台账。省掉每天的转记和核对。',
    o2l_hero_cta: '免费试用',
    o2l_hero_cta_note: '未注册可试 1 次，注册后免费 3 次。',
    o2l_ex_eyebrow: '转换示例',
    o2l_ex_title: '这份订单，会变成这张台账',
    o2l_ex_lead: '这是用 AI 实际整形一份虚构示例订单得到的结果。',
    o2l_ex_before: '整形前：订单（PDF）',
    o2l_ex_after: '整形后：受注台账（可下载为 Excel）',
    o2l_ex_img_alt: '示例订单（由株式会社サンプル商事发给大阪サンプル卸株式会社，共 5 行明细）',
    o2l_ex_p1: '得意先（客户）从发件方读取，不会和标着「御中」的收件方（即自家公司）混淆。',
    o2l_ex_p2: '小计、消费税、合计不是明细，不会作为台账的行。',
    o2l_ex_p3: '明细里单独指定的交货日（第 5 行）优先于抬头的交货日。',
    o2l_ex_note: '※ 根据格式不同，可能会读错。下载前请务必核对内容。（备注列未显示）',
    o2l_faq_eyebrow: '常见问题',
    o2l_faq_title: '导入前常被问到的问题',
    o2l_faq_q1: '识别准确吗？',
    o2l_faq_a1:
      '我们用自己的示例订单在线上环境确认过：得意先、品番、数量、单价、金额、交货日都和正确答案一致。但根据格式不同，仍可能读错，请以下载前人工核对为前提使用。定制开发时，会用贵公司的真实订单边验证边调整。',
    o2l_faq_q2: '支持哪些文件？',
    o2l_faq_a2:
      '支持含文字信息的 PDF、Excel、CSV。扫描件和照片（图片）的识别正在确认准确度，目前处于准备中。',
    o2l_faq_q3: '能和弥生、销售管理软件对接吗？',
    o2l_faq_a3:
      '目前不支持与软件直接对接（API）。我们会按照您所用软件的导入格式，交付对应的 Excel。',
    o2l_faq_q4: '把客户的订单数据发过来安全吗？',
    o2l_faq_a4:
      '文件在您的浏览器内读取，文件本身不会发送。只有点「用 AI 整形成台账」时，读取到的文字才会经由我们的服务器发送给 AI，我们的服务器不保存。使用的 AI 显示在演示区。详情请见隐私政策。',
    o2l_faq_q5: '咨询后多久能得到回复？',
    o2l_faq_a5: '我们会在 1 个工作日内回复。咨询免费。',
    o2l_faq_q6: '费用包含哪些内容？',
    o2l_faq_a6:
      '包含需求沟通、确定输入（订单）与输出（台账、导入用 Excel）的格式、交付成品，以及 2 次修改。维护改进为可选，另按月收费。',
    o2l_faq_q7: '交付需要多久？',
    o2l_faq_a7:
      '收到全部相关文件后，最快 1 个工作日交付第一版台账。含调整在内的完成时间，根据内容与您商定。',
    o2l_flow_eyebrow: '你是不是也在这样做？',
    o2l_flow_title: '每天把订单一行行抄进台账',
    o2l_before_label: '现在的做法',
    o2l_before_1: '客户发来 PDF / Excel 订单',
    o2l_before_2: '人工逐项目视确认',
    o2l_before_3: '一行行手动录进受注台账',
    o2l_before_4: '再核对有没有录错',
    o2l_after_label: '自动化之后',
    o2l_after_1: '上传订单',
    o2l_after_2: 'AI 读取内容',
    o2l_after_3: '受注台账自动生成',
    o2l_after_4: '人只需确认，导出 Excel',
    o2l_pain_eyebrow: '常见的烦恼',
    o2l_pain_title: '这些手工活，是不是成了负担',
    o2l_pain1_title: '每天转记很花时间',
    o2l_pain1_desc: '订单多的日子，光录台账就要好几个小时，正经活反而顾不上。',
    o2l_pain2_title: '录错 + 核对的负担',
    o2l_pain2_desc: '手工录入容易把数量、单价打错，事后还得逐条核对。',
    o2l_pain3_title: '每家客户格式都不一样',
    o2l_pain3_desc: '模板搞不定的格式差异，AI 能从上下文读懂。',
    o2l_demo_eyebrow: '实际试一下',
    o2l_demo_title: '用你手边的订单，当场转换',
    o2l_demo_lead:
      '选择订单（PDF / Excel / CSV），就会转成受注台账的样子。文件在你的浏览器内读取，文件本身不会发送到服务器。',
    o2l_drop_text: '把订单（PDF / Excel / CSV）拖到这里，或点击选择（最多 10 个）',
    o2l_drop_hint:
      '文件在浏览器内读取（文件本身不发送）。扫描件 / 图片为了识别会发送图片（发送前会确认）。',
    o2l_sample_btn: '用示例订单试试',
    o2l_drop_title: '选择文件',
    o2l_sample_view: '查看示例内容（PDF）',
    o2l_ai_send_note:
      '点「用 AI 整形成台账」时，只会把读取到的文字经由我们的服务器发送给 AI（文件本身不发送）。',
    o2l_ai_route_label: '使用的 AI：',
    o2l_file_image: '图片',
    o2l_ai_cancelled: '已取消发送图片。',
    o2l_ai_vision_pending:
      '图片/扫描件的 OCR 正在准备中。含文字信息的 PDF、Excel、CSV 可照常使用。',
    o2l_cf_title: '要作为图片识别吗？',
    o2l_cf_body:
      '这个文件没有文字信息，需要作为图片识别。此时图片本身会经由我们的服务器，发送给演示区显示的 AI。（文字 PDF / Excel / CSV 不会发送文件本身。）',
    o2l_cf_ok: '发送并识别',
    o2l_cf_cancel: '取消',
    o2l_status_parsing: '读取中…',
    o2l_err_toobig: '文件太大（最多 5MB）。',
    o2l_err_type: '不支持的文件格式（PDF / Excel / CSV）。',
    o2l_err_parse: '读取失败，请换个文件试试。',
    o2l_err_scanned:
      '这个 PDF 好像没有文字层（扫描件 / 图片）。目前只能读有文字的 PDF、Excel、CSV（扫描件识别即将支持）。',
    o2l_badge_local: '✓ 全部在你的浏览器内完成',
    o2l_download: '导出 Excel',
    o2l_result_note:
      '※ 上面是读到的文件。点「AI 整形成台账」把每个文件结构化，合并成一张表并下载。',
    o2l_files_skipped: '未能读取、已跳过:',
    o2l_ai_btn: '用 AI 整形成台账（免费）',
    o2l_ai_working: 'AI 整形中…',
    o2l_ai_disabled: 'AI 整形即将上线。读取结果可从上面的表格下载。',
    o2l_ai_anon_used: '免费体验（1 次）已用完。注册后可用 3 次。',
    o2l_ai_register_link: '免费注册 →',
    o2l_ai_member_used: '免费体验（3 次）已用完。欢迎免费咨询。',
    o2l_ai_daily: '今日免费体验已达上限，请稍后再试。',
    o2l_ai_toobig: '文件较大，免费体验只处理了开头部分。',
    o2l_ai_error: '整形失败，请稍后重试。',
    o2l_ai_login: '准备中，请刷新页面后再试。',
    o2l_ledger_done: '✓ AI 已整形成台账',
    o2l_ledger_download: '导出台账 Excel',
    o2l_price_eyebrow: '价格',
    o2l_price_title: '小步开始，用多少算多少',
    o2l_price_free_title: '先免费体验',
    o2l_price_free_price: '¥0',
    o2l_price_free_desc: '未注册可试 1 次，注册后免费 3 次。',
    o2l_price_paid_title: '小型自动化',
    o2l_price_paid_price: '5万日元起',
    o2l_price_paid_desc:
      '按贵司订单/台账格式单独定制。包含需求沟通、确定输入输出格式、交付成品、2 次修改。先免费聊聊需求。',
    o2l_price_maint: '维护改进 每月 5,000 日元起（可选）。',
    o2l_trust_eyebrow: '为了让你放心使用',
    o2l_trust_title: '数据怎么处理',
    o2l_trust1: '文件在你的浏览器内读取，文件本身不会发送到我们的服务器。',
    o2l_trust2:
      '只有点「用 AI 整形成台账」时，才会把读取到的文字经由我们的服务器发送给 AI（扫描件 / 图片会发送图片，发送前会确认）。使用的 AI 显示在演示区。',
    o2l_trust3: '我们的服务器不保存发送过来的内容。',
    o2l_trust4: '所有通信都经过加密（HTTPS）。',
    o2l_trust_privacy: '更详细的处理方式请见隐私政策。',
    o2l_cta_title: '先告诉我们，你现在是怎么做的。',
    o2l_cta_lead: '可以免费试用，也可以按贵司业务聊聊怎么自动化。',
    o2l_cta_try: '免费试用',
    o2l_cta_consult: '免费咨询',
    o2l_consult_title: '按您的业务来聊聊需求',
    o2l_consult_lead: '写下目前的作业流程或困扰，我们会在 1 个工作日内回复。不收费。',
    o2l_f_name: '您的称呼',
    o2l_f_company: '公司名称（选填）',
    o2l_f_email: '电子邮箱',
    o2l_f_message: '咨询内容',
    o2l_f_submit: '提交',
    o2l_f_sending: '提交中…',
    o2l_f_ok: '已提交。我们会在 1 个工作日内回复，谢谢。',
    o2l_f_invalid: '请检查称呼、邮箱和咨询内容。',
    o2l_f_error: '提交失败，请稍后再试。',
    o2l_f_privacy_pre: '提交即表示同意我们的',
    o2l_f_privacy_link: '隐私政策',
    o2l_f_privacy_post: '。',
    pp_eyebrow: '隐私',
    pp_title: '隐私政策',
    pp_updated: '制定日期：2026年10月5日／修订日期：2026年10月6日',
    pp_intro:
      '千里同風株式会社（以下简称“本公司”）依据以下方针，妥善处理您在本公司网站（senridf.com）及各工具与服务中的个人信息。',
    pp_s1_h: '1. 收集的信息',
    pp_s1_b:
      '本公司可能收集以下信息：(1) 您在咨询/相談表单中填写的姓名、公司名称、邮箱和咨询内容；(2) 注册会员时的邮箱；(3) 网站使用情况（访问时间、浏览页面、大致使用次数等）；(4) 您在各工具中输入或上传的内容（处理范围见第4条）。',
    pp_s2_h: '2. 使用目的',
    pp_s2_b:
      '收集的信息用于回应咨询、联系相談与报价、提供与改进服务、防止滥用。未经本人同意，不会超出上述目的范围使用。',
    pp_s3_h: '3. 外部服务与第三方提供',
    pp_s3_b:
      '除法律要求外，本公司不会向第三方出售或提供您的个人信息。但为提供服务，我们使用以下外部服务，并在处理所需范围内发送数据。',
    pp_s3_qwen: '生成式AI（阿里云“通义千问”／DashScope）— 用于翻译、文档整理等AI处理。',
    pp_s3_sf:
      '生成式AI（SiliconFlow，运营方：SILICONFLOW LABS PTE. LTD.〔新加坡〕，模型：Google Gemma 4）— 用于受発注演示的AI整形与图片识别。受発注演示实际使用的AI会显示在演示区。图片/扫描件仅在发送前经确认弹窗同意后才会发送。',
    pp_s3_google: 'Google / Firebase — 用于登录认证与数据存储（Firestore）。',
    pp_s3_cf: 'Cloudflare — 用于网站分发与访问分析。',
    pp_s3_dg: 'Deepgram — 在您使用语音口译功能时，用于将语音转为文字。',
    pp_s4_h: '4. 关于浏览器内处理',
    pp_s4_b:
      '在受発注演示等部分工具中，含文字信息的 PDF、Excel、CSV 文件在您的浏览器内解析，文件本身不会发送到本公司服务器。仅在您使用「AI 整形」时，读取到的文字（图片/扫描件则在确认与同意后发送图片）会经由本公司服务器发送给上述生成式AI。本公司服务器不保存这些内容。',
    pp_s5_h: '5. 保存期限',
    pp_s5_b:
      '咨询与相談内容将为处理及必要记录而保存。访问分析等统计数据会在一定期限后自动删除。不再需要保存的个人信息，将以适当方式销毁。',
    pp_s6_h: '6. 您的权利',
    pp_s6_b:
      '您可就本人的个人信息要求披露、更正、删除或停止使用。如有需要，请联系下方联系方式。我们将在确认本人身份后依法处理。',
    pp_s7_h: '7. Cookie 与访问分析',
    pp_s7_b:
      '为提升便利性与了解使用情况，本公司网站可能使用 Cookie 或类似技术及访问分析。其中不包含可直接识别个人身份的信息。',
    pp_s8_h: '8. 咨询与经营者信息',
    pp_s8_b: '关于本政策的咨询，以及个人信息处理相关的请求，请通过以下方式联系我们。',
    pp_biz_name: '经营者名称',
    pp_biz_rep: '代表者',
    pp_biz_addr: '所在地',
    pp_biz_contact: '联系方式',
    pp_biz_addr_val: '大阪市',
    pp_s9_h: '9. 本政策的修订',
    pp_s9_b: '本公司可能因法律变更或服务改进而修订本政策。如有重要变更，将在本页面通知。',
    solutions_body:
      '先用在线工具，把 AI 用到日常工作里。在此之上，我们也在开发嵌入生成式 AI 的硬件。',
    sol_now_eyebrow: '提供中',
    sol_now_title: '现在就能用的 AI 工具',
    sol_feat_tag: '业务自动化',
    sol_feat_p1: '用示例订单，无需注册即可马上试用',
    sol_feat_p2: '按贵司格式定制，5万日元起',
    sol_feat_p3: '咨询在 1 个工作日内回复',
    sol_feat_cta: '查看详情·免费试用',
    sol_more_pre: '翻译、文书分析、日语学习等 AI 工具，可在',
    sol_more_link: '应用一览',
    sol_more_post: '中试用。',
    sol_dev_eyebrow: '开发中',
    sol_dev_title: '嵌入 AI 的硬件',
    sol_dev_badge: '开发中',
    services_eyebrow: '服务',
    services_title: '我们能提供什么',
    srv1_name: '市场与行业调研',
    srv1_desc: '跨境分析、竞争评估、用户洞察。基于对日本市场的深度理解，提供专业调研服务。',
    srv2_name: '产品企划与市场进入支持',
    srv2_desc: '从供应链调研、用户研究、概念开发，到合作伙伴促成，提供全链条支持。',
    srv3_name: 'AI集成硬件开发',
    srv3_desc: '支持集成生成式AI、图像识别、语音界面的硬件产品企划与原型开发。',
    product1_category: '教育',
    product1_name: 'AI学习设备',
    product1_desc: '搭载生成式AI技术的儿童学习设备。通过互动对话深化学习体验。',
    product2_category: 'IoT',
    product2_name: '图像识别 IoT设备',
    product2_desc: '搭载高精度图像识别功能的智能IoT设备。理解环境并做出恰当响应。',
    product3_category: '娱乐',
    product3_name: 'AI互动玩具',
    product3_desc: '与生成式AI联动的新一代互动玩具。培育孩子的创造力与感性。',

    demo_page_title: '千里同風株式会社 — 应用商店',
    demo_eyebrow: '应用',
    demo_title: '应用商店',
    demo_intro: '我们开发的 AI 应用，可以在浏览器中直接使用。各应用将持续更新。',

    analysis_title: '文件分析 · 对比报告',
    analysis_desc:
      '上传多份 PDF、Word、Excel，AI 跨文件交叉分析，自动生成对比报告。适合商业模型比较与调研分析。',
    analysis_cta: '打开分析工具',

    lifestory_title: '生平故事 · 人生访谈',
    lifestory_desc:
      '约 100 个精心设计的问题，以文字或语音作答，AI 为你撰写完整的人生传记。每次几题，大约一个月完成。',
    lifestory_cta: '开始记录',

    japanese_title: '日语动词变位工具',
    japanese_desc:
      '内置 214 个常用动词词库，自动生成五段・一段・不规则动词变形，含中英双语释义。支持查表、翻牌练习、随机小测试三种模式。',
    japanese_cta: '开始学习',

    proofreader_label: 'Live · 会员限定',
    proofreader_title: '中文文稿校对助手',
    proofreader_desc:
      '上传 Word 或粘贴文本，自动检查错别字、重复句、编辑指令残留及前后逻辑冲突，输出分类校对报告。',
    proofreader_cta: '开始校对',

    bids_title: '大阪市招标信息监控',
    bids_desc:
      '每日自动抓取大阪市政府发布的業務委託与物品供給招标公告，提供中文摘要，便于快速筛选适合小型企业的项目。',
    bids_cta: '查看招标信息',

    /* 功能标签（不按 toB/toC，按功能分；一个工具可带多个标签） */
    tag_all: '全部',
    tag_speech: '语音识别',
    tag_translate: '翻译',
    tag_docs: '文档解析',
    tag_generate: '文本生成',
    tag_verify: '校对·校验',
    tag_scrape: '自动采集',
    tag_dict: '词表·变位',
    tag_empty: '没有匹配的工具。',
    tag_status: '共 {total} 个工具，当前显示 {n} 个。',
    badge_open: '无需登录',
    /* 卡片上的一句话（长说明留在各工具页里） */
    tl_one: '中日互译，并列显示回译，便于核对有没有译错。',
    analysis_one: '上传多份 PDF、Word、Excel，跨文件分析并生成对比报告。',
    proofreader_one: '错别字、重复句、前后矛盾一次查清，输出分类报告。',
    lifestory_one: '回答约 100 个问题，AI 为你写成一本完整的人生传记。',
    japanese_one: '214 个常用动词变位自动生成，无需登录，打开即用。',
    bids_one: '每日抓取大阪市招标公告，附中文摘要，便于快速筛选。',

    blog_page_title: '千里同風株式会社 — 博客',
    blog_eyebrow: '博客',
    blog_title: '洞察',
    blog_intro: '记录我们对AI、硬件与日本市场的思考与发现。',
    blog_empty: '文章即将发布，敬请期待。',
    /* Blog tags（固定映射表。未登记的分类原样显示） */
    blog_tag_ai_hardware: 'AI 与硬件',
    blog_tag_research: '市场调研',
    blog_tag_product: '产品开发',
    blog_tag_news: '公司动态',
    blog_tag_tech: '技术笔记',

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
    tl_back_unverified: '⚠ 回译没成功，这一句未经校验，建议重说一遍',
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
    tl_marker_recording: '● 录音中',
    tl_confirm_clear: '确认清空记录？',
    tl_confirm_new_meeting: '确定要清空转录记录吗？',
    tl_speak_title: '朗读',
    tl_generating: '生成中…',
    tl_local_no_voice: '本地环境不支持语音功能。',
    tl_connecting: '连接中…',
    tl_ws_error: 'WebSocket 连接出错。',
    tl_mic_denied: '麦克风权限被拒绝，请在浏览器设置中允许访问。',
    tl_no_speech: '没有识别到语音，请检查麦克风输入和权限。',
    tl_err_download: '下载文件失败，请重试。',
    tl_err_no_transcript: '没有转录记录，无法生成纪要。',
    tl_err_summary: '生成纪要失败（{msg}），请稍后重试。',
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

    /* Life story tool（2026-08-17 三语化。⚠️ 问题库未翻译——理由见
       docs/tools/04-lifestory.md） */
    ls_page_title: '生平故事 · 千里同風',
    ls_back: '← 返回',
    ls_hdr_title: '生平故事',
    ls_btn_gen: '生成我的故事',
    ls_w_title: '记录你的故事',
    ls_w_desc: '当你觉得够了，AI 会为你写出一篇传记。',
    ls_w_desc1: '我会提出一些问题，你用文字或语音回答。',
    ls_w_desc2: '不需要一次说完，随时可以停下来。',
    ls_btn_start: '开始 →',
    ls_btn_prev_story: '查看上次的故事',
    ls_loading_msg: '正在思考下一个问题…',
    ls_mic_lbl: '语音输入',
    ls_recording: '录音中… {n} 秒',
    ls_reconnecting: '重新连接中…（{n}/2）',
    ls_char_ct: '{n} 字',
    ls_btn_skip: '跳过这题',
    ls_btn_submit: '提交回答 →',
    ls_btn_continue: '继续 →',
    ls_bw_title: '这段到这里',
    ls_btn_more: '继续回答',
    ls_btn_rest: '先到这里',
    ls_story_hdr_title: '我的生平故事',
    ls_btn_back: '← 返回',
    ls_export: '导出',
    ls_import: '导入',
    ls_reset: '重置',
    ls_export_title: '导出所有数据为 JSON',
    ls_import_title: '从 JSON 文件恢复数据',
    ls_reset_title: '清除所有数据，无法恢复',
    ls_gen_summary: '即将基于 {n} 条回答生成故事',
    ls_gen_summary_cats: '，涉及 {n} 个主题。',
    ls_gen_confirm: '确定生成吗？',
    ls_writing: '正在撰写你的故事',
    ls_writing_note: '这可能需要 30-60 秒…',
    ls_regenerate: '重新生成',
    ls_q_num: '第 {n} 题',
    ls_restored: '✓ 检测到未提交的回答，已为你恢复。',
    ls_need_answer: '请先写下你的回答，或者点"跳过这题"。',
    ls_understanding: '正在理解你的回答…',
    ls_submit_failed: '提交失败：',
    ls_retry: '重试',
    ls_clear_filter_continue: '清除筛选，继续',
    ls_gen_story: '生成故事',
    ls_today_enough: '今天到这里吧',
    ls_or_pick_theme: '或选择只回答关于某个主题的问题：',
    ls_only_theme: '仅 {cat}',
    ls_all_continue: '全部继续 →',
    ls_filtered: '已筛选：仅回答关于 {theme} 的问题',
    ls_clear_filter: '清除筛选',
    ls_no_data: '没有数据可导出。',
    ls_downloaded: '✓ 数据已下载',
    ls_confirm_import: '即将导入 {n} 条回答。现有数据将被覆盖。确定吗？',
    ls_confirm_overwrite: '当前已有 {n} 条回答。覆盖还是合并？（取消=取消导入）',
    ls_imported: '✓ 已导入 {n} 条回答。页面将刷新。',
    ls_import_failed: '导入失败：',
    ls_confirm_reset: '确定要清除所有回答和数据吗？此操作不可撤销。',
    ls_no_speech: '您的浏览器不支持语音输入，请使用 Chrome 或 Edge。',
    ls_hint_short: '太短了，AI 可能理解不了。试试说得详细一点？',
    ls_hint_ok: '✓ 长度适中',
    ls_hint_long: '⚠ 有点长，可以精简',
    ls_hint_too_long: '太长了，建议 200-400 字',
    ls_answered: '已回答 {n} 题',
    ls_remaining: ' · 还剩 {n} 题',
    ls_welcome_back: '欢迎回来',
    ls_that_place: '那里',
    ls_cat_origin: '起点',
    ls_cat_family: '家人',
    ls_cat_growing: '成长',
    ls_cat_work: '职业',
    ls_cat_turning: '转折',
    ls_cat_bonds: '关系',
    ls_cat_setback: '挫折',
    ls_cat_passion: '热忱',
    ls_cat_inner: '内心',
    ls_cat_values: '价值观',
    ls_cat_money: '金钱',
    ls_cat_influence: '影响力',
    ls_cat_regret: '遗憾',
    ls_cat_mark: '印记',
    ls_cat_legacy: '传承',
    api_bad_gateway:
      '服务器暂时无法处理请求（HTTP {status}）。这不是本站服务返回的，通常是上游超时或被平台拦下，请稍后重试。',
    api_not_found: '接口地址不存在（HTTP {status}）。多半是部署或路由的问题，不是你的操作有误。',
    api_not_json: '服务器返回了预期之外的内容（HTTP {status}）。这不是本站服务返回的。',
    ls_answer_placeholder: '在这里写下你的回答…',
    ls_privacy_note: '（其中 {n} 条标记为隐私，不会被分析）',
    ls_gen_timeout: '生成超时（服务器响应过慢）。请稍后重试。',
    ls_gen_failed: '生成失败：',
    ls_loading_first: '正在准备问题…',
    ls_all_answered: '你已经回答了所有问题！',
    ls_can_gen_now: '已回答 {n} 题，现在可以生成故事，或者继续深入。',
    ls_soft_landing: '没关系，有些经历确实适合存放在心底。\n我们换个方向聊聊别的。',
    ls_well_done: '了不起',
    ls_good_pause: '这里是一个好的停顿',
    ls_shared_n: '你已经分享了 {n} 个故事片段。',
    ls_come_back: '随时回来继续，你的答案都保存好了。',
    ls_bad_format: '数据格式错误：缺少 answers 数组',
    ls_sum_shared: '你已经分享了 {n} 个故事片段',
    ls_sum_themes: '涉及 {c} 个主题，共约 {n} 字。',
    ls_sum_ready: '准备好继续了吗？',
    ls_theme_done: '“{cat}” 主题的问题都答完了！要继续回答其他主题，还是生成故事？',
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
    pf_show_dismissed: '显示已忽略（{n}）',
    pf_hide_dismissed: '隐藏已忽略（{n}）',
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
    ce_ev_h: '凭证（照片・PDF）',
    ce_ev_intro:
      '把收据、请求书、纳付书等的照片或 PDF 放进来，会在这台电脑里识别文字，生成交易日・金额・交易方的草稿（图片不会上传）。核对后点「确认」就登记进索引簿，可以按交易日・金额・交易方检索（电子账簿保存法的检索要件）。原件不改名、不改内容，保存在工作文件夹的 evidence/ 里。',
    ce_ev_need_folder:
      '凭证功能要先用「选择工作文件夹」打开文件夹才能用（要把原件和索引簿写进文件夹）。',
    ce_ev_add_paper: '添加纸质凭证（照片・扫描）',
    ce_ev_add_elec: '添加电子收到的文件',
    ce_ev_kinds:
      '「纸质」是拍照或扫描的纸单据；「电子」是通过邮件、下载、网银收到的数据（法律要求按数据原样保存）。区分是页面按文件的样子先判的：对方扫描后用邮件发来的请求书，看着是纸质，其实算「电子」。请在确认时改对。确认后，原件会归进对应的文件夹。',
    ce_ev_paper_notice:
      '纸质单据的照片只是工作用的副本。本工具不满足扫描保存的要件（需要认定的时间戳），纸质原件请保存 7 年（国税厅 一问一答【扫描保存】问31・32・59）。',
    ce_ev_drafts:
      '有 {n} 条草稿还没确认。请核对交易日・金额・交易方后点「确认」（未确认的不会用于记账）。',
    ce_ev_q_date: '交易日',
    ce_ev_q_amount: '金额',
    ce_ev_q_party: '交易方',
    ce_ev_err_need: '先填上{list}再确认（电子帐簿保存法要求能按日期・金额・交易方检索）',
    ce_ev_q_void: '含已取消',
    ce_ev_search: '检索',
    ce_ev_clear: '清除',
    ce_ev_col_code: '附件编号',
    ce_ev_code_title: '写在纸右上角的编号（E2604-07 的格式）。灰色的字是建议的下一个编号',
    ce_ev_code_save: '保存编号',
    ce_ev_col_status: '状态',
    ce_ev_col_doc: '单据',
    ce_ev_col_file: '文件',
    ce_ev_col_bank: '对应流水',
    ce_ev_empty: '还没有凭证。',
    ce_ev_st_draft: '草稿',
    ce_ev_st_ok: '已确认',
    ce_ev_st_void: '已取消',
    ce_ev_kind_paper: '纸质',
    ce_ev_kind_elec: '电子',
    ce_ev_confirm: '确认',
    ce_ev_fix: '修改',
    ce_ev_void: '取消',
    ce_ev_reason_ok: '确定',
    ce_ev_reason_need: '请填写理由',
    ce_s_note: '⚠ 请看下面的说明',
    ce_c_book_d: '公司・员工・期初余额・固定资产等，一张表填一类。',
    ce_c_bank_t: '银行流水',
    ce_c_bank_d: '网银下载的 CSV・Excel 原样放进去，要覆盖到结账月份的月末。',
    ce_pick_tip:
      '选文件夹的对话框里只显示文件夹，看不到里面的文件是正常的：点进工作文件夹后，按「选择文件夹」。',
    ce_list_toggle: '各项检查明细（11 项）',
    ce_rp_title: '银行规则试跑',
    ce_rp_sum_ok: '（规则 {n} 条・流水 {rows} 笔）',
    ce_rp_sum_warn: '（⚠ 有 {w} 处需要看一下）',
    ce_rp_intro:
      '把「{sheet}」表里的规则，对结账期间（{first}〜{last}）的 {rows} 笔流水试了一遍。结账前就可以把规则改好。',
    ce_rp_norules: '「{sheet}」表里还没有规则。没有也能结账（每一笔流水都会问你）。',
    ce_rp_unused:
      '有 {n} 条规则一笔流水都没对上。请核对「摘要包含」和流水里的摘要是否一字不差（半角片假名要照原样写）。',
    ce_rp_multi:
      '有 {n} 笔流水同时符合两条以上的规则。结账时不会猜，会一笔一笔问你。请把规则改成只有一条能对上。',
    ce_rp_answered: '已回答',
    ce_rp_hits: '每条规则对上的笔数',
    ce_rp_n: '{n} 笔',
    ce_rp_more: '另有 {n} 笔',
    ce_rp_n_total: '{n} 笔・合计 {a}',
    ce_rp_none_pre:
      '没有规则的流水，结账之后会列在这里。工资、社保、税金的支付和自己账户之间的互转会自动核对，不需要写规则。',
    ce_rp_none_zero: '没有缺规则的流水。',
    ce_rp_none:
      '有 {n} 笔流水没有规则（摘要 {k} 种）。每个月都出现的摘要，写进「{sheet}」表后下次就自动记账。',
    ce_ev_reason_fix: '修改已确认条目的理由（会记入修改删除记录）',
    ce_ev_reason_void: '取消的理由（条目和原件都不删除，会留下记录）',
    ce_ev_dup: '{name} 已经导入过了（内容相同）',
    ce_ev_err_read: '{name} 读取失败：{msg}（原件已保存，请在草稿里手动填写）',
    ce_ev_reading: '识别中：{name}（第 {i}/{n} 个文件・第 {p}/{pn} 页）——照片每页约 10–60 秒',
    ce_ev_done: '已识别 {n} 页（{s} 秒）',
    ce_ev_ocr: '读取照片・扫描件上的文字',
    ce_z_queued: '前面的文件处理完后，接着处理这 {n} 个文件',
    ce_ev_queued: '前面的文件识别完后，接着识别这 {n} 个文件',
    ce_ev_preparing:
      '准备中：{name}（第 {i}/{n} 个文件）——正在准备识别助手和读取工具；表格还在检查时，要等它做完',
    ce_ev_helper_idle:
      'Windows 电脑上，先打开本机识别助手，每页约 1 秒、全部页都读（图片不离开这台电脑）。没有助手时在浏览器里只读第 1 页（每页 10〜60 秒，期间电脑负载较高）。',
    ce_ev_rereading:
      '后台精读中（{i}/{n}）：{name} 第 {p} 页——认出了单据种类但验算没过的页，在浏览器里再读一遍（每页 1–2 分钟）。这期间可以先确认其他草稿',
    ce_ev_reread_sum: '{r} 页因为验算没过，又用浏览器读了一遍（其中 {b} 页用了再读的结果）',
    ce_ev_helper_on:
      '用本机识别助手（{v}）识别：每页约 1 秒，全部页。认出了单据种类但验算没过的页，全部读完后再在浏览器里读一遍（每页 1–2 分钟）',
    ce_ev_helper_off:
      '本机识别助手没有在运行。请双击 start-ocr-helper.cmd 打开它，窗口保持开着。这次先在浏览器里只读第 1 页（每页 10〜60 秒，期间电脑负载较高）',
    ce_ev_helper_lost:
      '本机识别助手中途停了（{msg}）。剩下的扫描页没有识别（原件已保存）。请重新打开助手，再放一次',
    ce_ev_reading_fast: '识别中：{name}（第 {i}/{n} 个文件・第 {p}/{pn} 页）',
    ce_ev_ocr_d:
      '能按单据种类验算的有：电费账单、大阪市水费账单、年金保险费缴纳通知、地方税缴纳书（QR）、中国电子发票。其他单据（收据、请求书、合同等）按单据上的字样读出日期・金额・交易方，但无法验算，请对照原件。带文字的 PDF 不管勾不勾都会马上读取。',
    ce_ev_pages: '（共 {n} 页）',
    ce_ev_done_noocr:
      '已保存 {f} 个文件，照片・扫描件没有识别文字（带文字的 PDF 读了 {n} 页・{s} 秒）',
    ce_ev_skipped: '{name}：照片・扫描件没有识别，直接保存了（未勾选读取文字）',
    ce_wp_ok:
      '✓ {name} → 已从底稿把期初余额 {n} 行（截至 {as_of}）和公司名・决算月・开始记账月份（{start}）写进公司资料（原文件备份：{path}）',
    ce_wp_ok_new:
      '✓ {name} → 已从底稿新建公司资料：期初余额 {n} 行（截至 {as_of}）・公司名・决算月・开始记账月份（{start}）。还缺什么，下面的检查结果会提示',
    ce_wp_check_ok: '{name}：读出的资产合计和底稿资产负债表的资产总计一致（{total} 日元）',
    ce_wp_check_ng:
      '△ {name}：读出的资产合计（{computed} 日元）和底稿资产负债表的资产总计（{total} 日元）对不上，请核对期初余额',
    ce_wp_added: '{name}：科目表里没有的科目已登记到「追加科目」：{list}',
    ce_wp_guessed: '△ {name}：有的科目是按余额方向定的区分（{list}），请在「追加科目」表里核对区分',
    ce_wp_rounding:
      '{name}：底稿里不足 1 日元的金额已四舍五入（差额 {r} 日元计入了繰越利益剰余金）',
    ce_wp_err_prior_year:
      '✗ {name}：这个年度有年初余额，但序时账里没有年初余额的明细。请放入上一年度的底稿，或者弥生会计的期初余额数据',
    ce_wp_err_no_journal:
      '✗ {name}：是财务底稿，但找不到序时账（有 中文科目・日文科目・明细科目・借方・贷方 表头的表）',
    ce_wp_err_no_bs: '✗ {name}：是财务底稿，但找不到资产负债表（年度末日期和资产总计要从这里读）',
    ce_wp_err_start:
      '✗ {name}：底稿年度末（{day}）的下一个月，和公司资料里「开始记账的月份」（{start}）不一致。请改其中一个',
    ce_z_workpaper:
      '△ {name}：这是财务工作底稿（年报），不是公司资料，没有保存。工具目前还不能从底稿读取。期初余额请把底稿资产负债表的期末余额抄到公司资料的「期初余额」表，或者放入弥生会计的期初余额数据。',
    ce_ev_attached: '已对应到这笔流水',
    ce_ans_credit_h: '谁付的（贷方）',
    ce_ans_credit: '贷方科目（垫付就选 未払金）',
    ce_ans_err_credit: '请选择贷方科目',
    ce_sg_same: '同名流水 {n} 笔以前记作「{acc}」（最近 {last}）——已预填，请确认后保存',
    ce_sg_similar:
      '同一收款方的流水 {n} 笔（例：{desc}）以前记作「{acc}」（最近 {last}）——已预填，请确认后保存',
    ce_sg_far:
      '同一收款方以前记作「{acc}」，但金额和以前（{amounts}）差很多，可能是别的交易，所以没有预填',
    ce_sg_use: '仍用这个科目',
    ce_sg_alts: '同名（同一收款方）的流水以前记过不同的科目，判断不了这次是哪一个，请选择：',
    ce_chip_bank_short: '流水只到 {d}（月末未核对）',
    ce_k_cash_short: '流水只到 {d}，月末余额未核对',
    ce_fx_jm_mode: '住民税的特别征收',
    ce_fx_opt_special: '有（填决定通知书上的月额）',
    ce_fx_opt_none: '没有（普通征收、上年没有收入等）',
    ce_fx_from_month: '开始月（YYYY-MM，例 2026-06；同额填到下一个 5 月）',
    ce_step_from: '结账期间：从',
    ce_step_to: '到',
    ce_fy_chip: '{y}年{m}月期（{from}〜{to}）',
    ce_period_latest: '只结最新一个月',
    ce_period_note:
      '决算月：{m} 月 · 账从 {start} 开始（期初余额是前一个月末的）· 银行流水到 {last}',
    ce_months_h: '查看月份',
    ce_err_period: '结账期间有误：',
    ce_p_save: '正在写出 {m} 的结账产物…',
    ce_fs_out_month: '已写入：{path}（底稿和两份汇总）',
    ce_fs_out_range: '已写入：{root}/ 下 {a}〜{b} 共 {n} 个月的文件夹（每月底稿和两份汇总）',
    ce_fx_btn: '直接填写',
    ce_fx_amount: '月额',
    ce_fx_until_may: '同额填到明年 5 月',
    ce_fx_mode: '通勤方式',
    ce_fx_opt_transit: '公共交通（定期票）',
    ce_fx_opt_car: '开车・骑车',
    ce_fx_pass_monthly: '1 个月的定期票费',
    ce_fx_one_way_km: '单程距离（公里）',
    ce_fx_parking: '停车费／月（可空）',
    ce_fx_evidence: '依据书类（例：2025 年 定时决定 决定通知书）',
    ce_fx_wages_koyou: '开始月之前支付的工资（雇用保险对象）',
    ce_fx_wages_rousai: '开始月之前支付的工资（劳灾对象）',
    ce_fx_estimate_paid: '上年度申报缴纳的概算保险费',
    ce_fx_withheld_employee: '上年度从工资扣的雇用保险',
    ce_fx_installment: '分期缴纳（分 3 次）',
    ce_fx_save: '保存（重新结账时写进资料）',
    ce_fx_saved: '✓ 已填写',
    ce_fx_err_required: '请填写：{f}',
    ce_fx_err_num: '{f} 要填 0 以上的数字',
    ce_err_fix: '填写的内容有问题：',
    ce_fs_written: '已写进 {name}（原文件备份：{path}）',
    ce_dl_file: '下载 {name}',
    ce_dl_report: '{name}',
    ce_open_folder: '选择工作文件夹',
    ce_cl_h: '最近的公司',
    ce_cl_item: '{name}：结到 {m}・待处理事项 {n} 件',
    ce_cl_never: '{name}：还没有结账',
    ce_cl_open: '打开',
    ce_cl_forget: '从列表移除',
    ce_reset: '重新开始…',
    ce_reset_q:
      '把这个文件夹里的 {n} 个文件挪到 {path}，从空文件夹重新开始（不删除；要找回就从那里挪回原处）',
    ce_reset_go: '挪走并重新开始',
    ce_reset_no: '取消',
    ce_reset_done: '已把 {n} 个文件挪到 {path}，可以从空文件夹重新开始',
    ce_reset_empty: '没有要挪的东西（已经是空文件夹）',
    ce_reset_left: '没挪走：{list}（是不是还在 Excel 里开着？关掉后再按一次）',
    ce_reset_err: '建不了 {name}：{msg}',
    ce_cl_denied:
      '✗ {name}：没有得到读写文件夹的许可。重新打开时，请在询问许可的窗口里点「允许」。',
    ce_cl_gone:
      '✗ {name}：找不到这个文件夹（被移动、删除或改了名）。请从列表移除，再重新选择文件夹。',
    ce_cl_d:
      '这个列表只保存在这个浏览器里（不保存文件夹里的内容）。每次打开，浏览器都会确认读写许可。',
    ce_open_hint:
      'Chrome、Edge 可以直接读写这个文件夹：结账结果和回答会自动存回去（每次浏览器都会确认权限）。其他浏览器请用「选择文件夹」（只读，需要下载）。',
    ce_fs_connected: '已连接：{name}（读写・{n} 个文件）',
    ce_fs_out: '已写入：{path}',
    ce_fs_book: '回答已写进 公司资料.xlsx（原文件备份：{path}）',
    ce_fs_dec: '回答已写进 decisions.yaml（备份：{path}）',
    ce_fs_locked:
      '写不进文件夹。公司资料.xlsx 是不是正在 Excel 里打开？关闭后再点「带着回答重新结账」（回答没有丢）。',
    ce_fs_err: '写入文件夹失败：{msg}',
    ce_chip_bank_ok: '银行与账面一致',
    ce_chip_bank_ng: '银行与账面不一致',
    ce_chip_sus: '暂记 {n} 笔・{v}（确认后数字可能变）',
    ce_asof: '截至 {d}',
    ce_k_rev: '本月收入',
    ce_k_profit: '本月利润',
    ce_k_cash: '月末存款',
    ce_k_items: '需要您处理',
    ce_k_ytd: '{f} 起累计 {v}',
    ce_k_cash_ok: '＝银行月末余额',
    ce_k_cash_ng: '≠银行月末余额',
    ce_k_cash_diff: '≠银行月末余额（账面比银行 {d}）',
    ce_b_info: '告知',
    ce_lead_info:
      '这些是计算前提的告知，不是错误，也不是缺资料。读一遍，和贵公司无关的话点「回答」→ 已处理，以后就不再出现。',
    ce_ev_date_hint:
      '「交易日」填单据上写的日期：领收书填领收日，请求书填开具日，口座振替的通知填扣款日。',
    ce_ev_linked_auto: '{d} {t}（自动对上）',
    ce_k_counts: '待确认 {ask}・待处理 {todo}・疑似错误 {err}（另有告知 {info}）',
    ce_up_h: '接下来要缴的',
    ce_up_note_open: '还有没处理完的事项。处理之后，这里的金额可能会变。',
    ce_up_note: '按月末余额估算，请以缴费通知、纳付书为准。',
    ce_up_shaho: '{m} 月份社保',
    ce_up_gensen: '源泉所得税',
    ce_up_jumin: '住民税',
    ce_up_tokurei: '（纳期特例）',
    ce_up_none: '没有',
    ce_out_h: '结账产物',
    ce_bs_h: '资产负债表',
    ce_pl_h: '利润表',
    ce_pl_month: '本月',
    ce_pl_ytd: '本期累计',
    ce_sr_h: '查分录（可跨年度）',
    ce_sr_d: '在已确定的年度和这次结账的期间里查分录。填了科目，就按总账显示余额。',
    ce_sr_acc: '科目',
    ce_sr_sub: '明细',
    ce_sr_text: '摘要等文字',
    ce_sr_from: '日期：从',
    ce_sr_to: '到',
    ce_sr_amount: '金额',
    ce_sr_go: '查找',
    ce_sr_count: '共 {total} 条，显示 {n} 条。',
    ce_sr_none: '没有找到。',
    ce_sr_closed: '已确定（{y} 期）',
    ce_sr_date: '日期',
    ce_sr_vno: '凭证',
    ce_sr_narr: '摘要',
    ce_sr_line: '科目',
    ce_sr_dr: '借方',
    ce_sr_cr: '贷方',
    ce_sr_bal: '余额',
    ce_sr_err: '✗ 请先结账。',
    ce_pl_settle: '决算整理',
    ce_pl_settle_note: '决算整理的分录不算进决算月的「本月」，单独列一栏；「本期累计」里包含它。',
    ce_bs_assets: '资产合计',
    ce_bs_le: '负债・净资产合计',
    ce_pl_net: '当期净损益',
    ce_sec_ca: '流动资产',
    ce_sec_ppe: '有形固定资产',
    ce_sec_intan: '无形固定资产',
    ce_sec_inv: '投资及其他资产',
    ce_sec_cl: '流动负债',
    ce_sec_ncl: '非流动负债',
    ce_sec_eq: '净资产',
    ce_sec_sales: '营业收入',
    ce_sec_cogs: '营业成本',
    ce_sec_sga: '销售及管理费用',
    ce_sec_noi: '营业外收入',
    ce_sec_noe: '营业外支出',
    ce_sec_ei: '特别利润',
    ce_sec_el: '特别损失',
    ce_sec_tax: '所得税费用',
    ce_sec_other: '其他',
    ce_items_h: '需要您处理的事项',
    ce_b_ask: '待确认',
    ce_b_todo: '待处理',
    ce_b_err: '疑似错误',
    ce_lead_ask: '账上已经先记了，需要您确认性质或前提。确认后重新结账，数字才是最终的。',
    ce_lead_todo: '缺资料或还没办的事。补好后重新结账。',
    ce_lead_err: '数字之间对不上，很可能是资料或账务有错。请看分析后选择处理方式。',
    ce_an: '分析',
    ce_sug: '建议',
    ce_items_none: '这一类没有事项。',
    ce_check_item: '检查 {id}：',
    ce_acct_h: '会计用：全部检查明细',
    ce_next_h: '下一步',
    ce_next_contact: '有 {n} 项引擎内部检查未通过（{ids}）——请附上底稿联系我们',
    ce_next_checks: '先处理 {n} 项未通过的检查（{ids}），做法见各行的「→」',
    ce_next_answer: '{n} 条待确认可以直接在本页点「回答」处理',
    ce_next_both: '{n} 条待确认可以回答，也可以改表（看每行说明）',
    ce_next_sheet: '{n} 条待确认需要先改表，再重新结账',
    ce_next_sheets: '需要打开的表：{list}（用 YAML 的话是 {files}）',
    ce_next_none: '没有需要处理的事项。请下载底稿核对',
    ce_how_answer: '本页回答',
    ce_how_sheet: '改表',
    ce_how_both: '回答或改表',
    ce_how_contact: '联系我们',
    ce_files_intro:
      '先选一个工作文件夹（空的也可以），再把资料放进下面两个入口。页面会看文件的内容，自己归类并存进这个文件夹。结账结果和回答也存在这里。',
    ce_tpl_xlsx: '下载空白模板',
    ce_tpl_yaml: '进阶：YAML 模板',
    ce_wb_sheets: 'Excel 表：',
    ce_fd_decisions: '结账后直接在本页点「回答」即可（可写回 Excel 的「回答」表）',
    ce_col_answer: '回答',
    ce_ans_intro:
      '在每一行点「回答」填写，然后点「带着回答重新结账」。回答会作为判断记录（判断人、日期、理由）保存。',
    ce_ans_btn: '回答',
    ce_ans_edit: '修改',
    ce_ans_saved: '✓ 已回答',
    ce_ans_action: '处理方式',
    ce_ans_book: '入账',
    ce_ans_done: '已处理（不入账）',
    ce_ans_account: '选择科目',
    ce_ans_sub: '明细（可选）',
    ce_ans_tax: '税区分：按科目的默认',
    ce_ans_neg:
      '被扣掉的部分填负数。例：付报酬 89,790＝支払報酬 100,000＋預り金 −10,210（代扣的源泉所得税）；收款 329,560＝売掛金 330,000＋支払手数料 −440（对方扣掉的手续费）。',
    ce_ans_split: '＋ 拆成多行',
    ce_ans_remove: '删除',
    ce_ans_diff: '差额 {n} 日元',
    ce_ans_evidence: '依据（凭证）',
    ce_ans_reason: '理由',
    ce_ans_by: '判断人',
    ce_ans_paid_on: '缴款日（流水里没有的缴款）',
    ce_ans_paid_on_hint: '实际缴款的日期，用来判断有没有超过期限',
    ce_ans_paid_on_pick: '理由里写着 {d}，填进缴款日',
    ce_ans_at: '判断日期 {d}',
    ce_ans_save: '保存回答',
    ce_ans_cancel: '取消',
    ce_ans_err_by: '请填写判断人',
    ce_ans_err_account: '请选择科目',
    ce_ans_err_sum: '各行金额合计与流水金额不一致',
    ce_ans_err_reason: '请写明理由',
    ce_rerun: '带着回答重新结账（{n} 条）',
    ce_dl_book: '下载写入回答的公司资料.xlsx',
    ce_dl_decisions: '下载回答文件（decisions.yaml）',
    ce_dl_note: '下次把这份文件放回文件夹，回答就不用重填。',
    ce_adv_yaml: '进阶：YAML 回答模板',
    ce_page_title: '月结引擎 — 千里同風',
    ce_title: '月结引擎（日本·试用版）',
    ce_subtitle: '工资 · 社保 · 源泉 · 银行对账 · 消费税 → 底稿',
    ce_logout: '退出',
    ce_stance_title: '判断交给人，核对交给工具。',
    ce_stance_body:
      '记账这一步，现在的会计软件和 AI 都能帮上忙。这个工具做的是之后月末的那一遍：把工资、社保、税金、银行余额一项一项对过去，对不上的地方连同理由一起告诉你。',
    ce_stance_a: '不靠猜来填。不知道的就说不知道，然后问你。',
    ce_stance_b: '每个数字都能查到出处：法令、费率表、你填的哪一行。',
    ce_stance_c: '财务数据不出这个浏览器。结好的分录可以带回你在用的会计软件。',
    ce_stance_tail: '技术是为人服务的。千里同風是这么想的。',
    ce_yayoi_note:
      '「弥生会計インポート」是把结账月份的分录写成弥生会计能导入的格式（弥生インポート形式）的文件。在弥生会计的［ファイル］→［インポート］里读取。科目名和弥生里登记的不一样时，导入界面会让你对应。',
    ce_yayoi_open_note:
      '「弥生会計期首残高」是把开始记账那个月的期初余额写成弥生会计能导入的格式的文件。打开弥生会计的［科目残高入力］，在［ファイル］→［インポート］里读取。里面没有繰越利益剰余金（弥生会计里这个科目不能直接输入）。导入后按［貸借調整］，弥生会计会自己算出来。算出的金额和这个工具期初余额里的繰越利益剰余金相同，就说明余额全部带过去了。',
    ce_cy_h: '年度确定',
    ce_cy_d:
      '把已经申报完的年度确定下来。确定后，这一年的数字不再变动；之后发现错误，在当年做更正分录。确定后，工作文件夹的 closed 文件夹里会生成确定文件，以后结账从下一年度的第一个月开始算。',
    ce_cy_by: '判断人',
    ce_cy_go: '确定 {m} 期',
    ce_cy_ok: '✓ 已确定 {end} 期（分录 {n} 条）。以后结账从 {next} 开始算。',
    ce_cy_err_open: '✗ 这一年度还有没处理完的事项，处理完再确定：{items}',
    ce_cy_err_checks: '✗ 有没通过检查的月份（{months}），改好再确定。',
    ce_cy_err_not_closed: '✗ 请先从年度第一个月结到年度末，再确定。',
    ce_cy_err_already: '✗ 这一年度已经确定过了。',
    ce_cy_err_by: '✗ 请填判断人。',
    ce_cy_err_other: '✗ 没能确定（{msg}）。',
    ce_cy_closed: '已确定的年度：{list}。结账从其下一年度的第一个月开始算。',
    ce_cy_item: '{end} 期（{by}・{at}）',
    ce_lr_h: '从弥生分录里找到的银行规则候选',
    ce_lr_h_dict: '从常见摘要找到的银行规则候选',
    ce_lr_sum_dict:
      '银行流水里有 {n} 行是哪家公司都一个意思的摘要（振込手续费・存款利息・家賃・水电燃气・通信）',
    ce_lr_d_dict:
      '这些是内置字典给出的候选，不是这家公司过去的记账。只有打勾的才写进公司资料。税务署・市役所・法务局・转给个人的款项等，意思不止一种，不做候选，逐条问你。',
    ce_lr_sum:
      '{name}：分录 {v} 条（{from}〜{to}），其中 {p} 条按日期和金额对上了银行流水。同一摘要的流水有 2 条以上、而且都记到同一个科目的，列为候选。',
    ce_lr_d:
      '候选只是候选。写进公司资料的只有打了勾的。工资、社保、税金的支付由结账时按计算核对，不列为候选。',
    ce_lr_inn: '收入',
    ce_lr_out: '支出',
    ce_lr_n: '{n} 条',
    ce_lr_none: '没有可以新增的候选（同一摘要已经有规则，或者没有凑够 2 条的摘要）。',
    ce_lr_split_h: '过去记账时科目不一致、没有列为候选的摘要',
    ce_lr_unknown_h: '科目表里没有的科目（在「追加科目」里登记后，这些科目的候选也能写入）',
    ce_lr_unknown_mark: '科目表里没有',
    ce_lr_by: '判断人',
    ce_lr_go: '把选中的规则写进公司资料',
    ce_lr_ok: '✓ 已把 {n} 条银行规则写进公司资料（原文件备份：{path}）',
    ce_lr_err_by: '✗ 请填判断人。',
    ce_lr_err_empty: '✗ 没有选中可以写入的候选。',
    ce_lr_err_no_bank:
      '✗ {name}：是弥生的分录，但文件夹里没有同期的银行流水。请先放入银行流水，再放一次。',
    ce_lr_err_no_book: '✗ {name}：是弥生的分录，但还没有公司资料。请先放入公司资料。',
    ce_lr_err_file: '✗ {name}：第 {line} 行不是弥生导入格式。',
    ce_pv_title: '这样回答会生成的分录',
    ce_pv_debit: '借方',
    ce_pv_credit: '贷方',
    ce_pv_wait: '选好科目、填好金额后，这里会显示分录。',
    ce_privacy: '财务数据只在这个浏览器里处理，不会发送到服务器。页面只下载运行环境和引擎本身。',
    ce_optional: '可选',
    ce_z_tab_t: '表格（Excel・CSV）',
    ce_z_tab_d: '公司资料、银行流水、弥生会計的期初余额和分录。拖到这里，或点「选择文件」。',
    ce_z_ev_t: '凭证（照片・PDF）',
    ce_z_ev_d: '收据、请求书、纳付书等。在这台电脑里读出日期・金额・交易方，图片不会上传。',
    ce_z_pick: '选择文件',
    ce_z_need_folder: '先选择工作文件夹，两个入口才能用（需要有地方存）。',
    ce_z_looking: '正在看：{name}',
    ce_z_wb_ok: '✓ {name} → 公司资料（公司资料.xlsx）',
    ce_z_wb_replaced: '✓ {name} → 已替换公司资料（原文件备份：{path}）',
    ce_z_bank_ok: '✓ {name} → 银行流水（bank 文件夹）',
    ce_z_bank_unchecked:
      '✓ {name} → 银行流水（bank 文件夹）。公司资料里还没有登记银行账户，列名还没对照（登记后，下次检查会自动对照）',
    ce_ev_helper_denied:
      '浏览器挡住了本页连接本机识别助手。请点地址栏左边的图标 →「此站点的权限」，把「本地网络访问」（此设备上的应用）改成「允许」，再刷新页面。这次先在浏览器里只读第 1 页',
    ce_ev_helper_ask:
      '浏览器正在询问是否允许「访问此设备上的其他应用」，请点「允许」（这是为了连上本机识别助手；最多等 60 秒）',
    ce_bk_cols:
      '{name}：从表头认不出日期・摘要・出金・入金・余额各是哪一列。请在公司资料的「银行账户」表里填列名',
    ce_bk_chain:
      '{name}：按表头认出的列读，余额有 {n} 处前后接不上，可能认错了列，所以没有登记。请在公司资料的「银行账户」表里填列名',
    ce_bk_choose:
      '{name}：期初余额里有好几个存款明细（{list}），分不出这份流水是哪一个。请在公司资料的「银行账户」表里登记',
    ce_bk_open_ng:
      '{name}：流水第一笔之前的余额是 {before} 日元，期初余额是 {opening} 日元，对不上。请确认流水是否从期初开始，或者期初余额是否正确',
    ce_bk_open_ok: '{name}：流水第一笔之前的余额 {before} 日元，和期初余额一致',
    ce_bk_ok:
      '✓ {name}：已在公司资料里登记银行账户「{acct}」（列：日期・摘要・出金・入金・余额＝{cols}；{n} 笔 {from}〜{to}，余额前后相接）。原来的公司资料已备份到 {path}',
    ce_z_bank_nobook: '✓ {name} → 银行流水（bank 文件夹）。还没有公司资料，列名尚未核对',
    ce_z_bank_other:
      '✗ {name}：看起来是银行流水，但表头（{found}）和公司资料「银行账户」表里登记的列名（{want}）不一样。请把登记的列名改成文件里的写法，再放一次',
    ce_z_unknown: '✗ {name}：不是公司资料、银行流水，也不是弥生会計的期初余额数据，没有保存',
    ce_z_op_ok: '✓ {name} → 已把 {n} 行写进公司资料的「期初余额」表（原文件备份：{path}）',
    ce_z_op_retained:
      '{name}：繰越利益剰余金 {amount} 日元是按借贷差额填的（和弥生会計的［貸借調整］算法相同）。请对照上期的资产负债表确认',
    ce_z_op_names:
      '{name}：有科目表里没有的科目名（{list}）。请在「期初余额」表里改名，或在「追加科目」表里登记',
    ce_z_op_no_book:
      '✗ {name}：是弥生会計的期初余额数据，但还没有公司资料。请先放入公司资料（开始记账的月份・决算月）',
    ce_z_op_exists:
      '✗ {name}：期初余额已经有 {n} 行，不覆盖。要重新导入，请先清空公司资料的「期初余额」表再放一次',
    ce_z_op_start:
      '✗ {name}：文件里的期首日（{day}）不是公司资料里「开始记账的月份」（{start}）的第一天。请改其中一个',
    ce_z_op_file:
      '✗ {name}：第 {line} 行不是弥生会計期初余额数据的格式（依次是期首日・勘定科目名・貸借区分・補助科目名・部門・前期繰越残高）',
    ce_z_op_book: '✗ {name}：公司资料里有需要改的地方，没有导入（{msg}）',
    ce_z_op_yaml: '✗ {name}：这个公司文件夹是用 YAML 录入的，不能导入',
    ce_z_err: '✗ {name}：没能读取（{msg}）',
    ce_z_skip: '✗ {name}：这种文件处理不了（表格要 Excel・CSV，凭证要图片・PDF）',
    ce_ev_generic: '按单据上「{key}」一栏读出。这类单据无法验算，请对照原件后再确认',
    ce_ev_generic_nokey: '按单据上的字样读出。这类单据无法验算，请对照原件后再确认',
    ce_ev_no_template: '这一类单据还不能自动读取。请点文件名打开原件，对照着填交易日・金额・交易方',
    ce_ev_fx_ask:
      '这是外币单据（{cur} {amt}）。请填入折算成日元后的金额。把用的汇率写在备注里，方便以后核对。',
    ce_ev_fx_rounded:
      '这是外币单据（{cur} {amt}）。单据上写的换算是 {amt} × {rate} ＝ {yen}，已四舍五入到日元填进金额，请核对。',
    ce_ev_fx_used:
      '这是外币单据（{cur} {amt}）。已把单据上写的换算 {amt} × {rate} ＝ {yen} 填进金额，请核对。',
    ce_ev_fx_unread:
      '这像是外币（{cur}）单据，但金额没能读准。请对照单据，填入折算成日元后的金额。',
    ce_ev_open: '打开原件：{name}',
    ce_ev_open_err: '没能打开原件（{msg}）',
    ce_fix_where:
      '「改表」改的是工作文件夹（就是刚才选的「{name}」文件夹）里的那份「公司资料.xlsx」，不是原来存放处的那一份。用 Excel 改好、保存、关掉 Excel 之后，再点「执行结账」。要补流水的话，放进上面的「表格」入口。',
    ce_ev_by_label: '判断人（这台电脑会记住；确认凭证、回答问题、银行规则、年度确定都记这个名字）',
    ce_rerun_note:
      '连接着工作文件夹时，回答会写进文件夹里的「公司资料.xlsx」（原文件会先备份到「结账结果/备份」）。',
    ce_period_why:
      '账要从开始月一个月一个月结下来，所以默认从会计年度的第一个月算到「到」的月份。结果里可以按月切换着看。只要一个月的话，点「只结最新一个月」。',
    ce_ev_box: '凭证明细与确认',
    ce_ev_count: '已有 {n} 张，其中 {d} 张待确认',
    ce_ev_count_none: '还没有凭证',
    ce_ev_col_kind: '区分',
    ce_ev_basis_photo: '图片文件 → 暂判为纸质',
    ce_ev_basis_scan: '没有文字的扫描 PDF → 暂判为纸质',
    ce_ev_basis_text: '带文字的 PDF → 暂判为电子',
    ce_ev_basis_vector: '软件生成的 PDF → 暂判为电子',
    ce_how_h: '怎么放（点图放大）',
    ce_how_1: '月底了，资料散在各处',
    ce_how_2: '表格放一处：公司资料和银行流水',
    ce_how_3: '照片和 PDF 放一处：收据、请求书',
    ce_how_4: '选这个文件夹，结账结果自己出来',
    ce_how_prev: '上一格',
    ce_how_next: '下一格',
    ce_close: '关闭',
    ce_step_files: '选工作文件夹，放入资料',
    ce_col_file: '文件',
    ce_col_need: '何时需要',
    ce_col_state: '状态',
    ce_f_company: '公司基本信息与方针',
    ce_fd_company:
      '都道府县、决算月、开始月，社保等 9 项方针，消费税身份，银行账户。每个判断写判断人和日期',
    ce_f_employees: '员工名册',
    ce_fd_employees: '出生日期、入职日、标准报酬月额、扶养人数、住民税月额、固定工资',
    ce_f_opening: '期初余额',
    ce_fd_opening: '开始月前一个月末的试算表（从原来的会计软件抄过来）',
    ce_f_bank: '银行流水',
    ce_fd_bank: '网银下载的文件直接放进来（CSV、Excel 都可以），要覆盖到结账月份的月末',
    ce_f_monthly: '每月工资变动・开票',
    ce_fd_monthly:
      'payroll.yaml（加班、时薪等与名册不同的部分）、sales.yaml（请求书）。没有就按名册固定工资计算',
    ce_f_bank_rules: '银行流水规则',
    ce_fd_bank_rules: '房租、手续费等每月都有的流水，写一次规则以后自动入账',
    ce_f_fixed_assets: '固定资产台账',
    ce_fd_fixed_assets: '每月计提折旧',
    ce_f_decisions: '对待确认的回答',
    ce_f_adjustments: '调整分录',
    ce_fd_adjustments: '不经过银行的交易、按比例分摊、决算整理（带判断人和日期）',
    ce_f_labor_insurance: '劳动保险年度更新',
    ce_fd_labor_insurance: '6〜7 月需要：开始前的工资、上一年度的概算保险费等',
    ce_f_corporate_tax: '法人税等计算表',
    ce_fd_corporate_tax: '决算月需要：申告调整、繰越欠损金、中间纳付等',
    ce_need_required: '必须',
    ce_need_monthly: '每月',
    ce_need_optional: '可选',
    ce_need_season: '6〜7月',
    ce_need_year_end: '决算月',
    ce_s_wait: '未检查',
    ce_s_ok: '✓ 已找到',
    ce_s_missing: '✗ 缺少',
    ce_s_gaps: '⚠ 还有 {n} 项待填（见下面的清单）',
    ce_s_error: '✗ 格式错误',
    ce_s_absent: '— 未提供',
    ce_s_warn: '⚠ 本月需要',
    ce_pick_folder: '选择工作文件夹',
    ce_upload_none: '尚未选择文件夹',
    ce_upload_count: '已选择 {n} 个文件',
    ce_upload_hint:
      '如使用事务所默认方针（office），请把该文件也放在文件夹内。文件只在这个浏览器里读取。',
    ce_pre_running: '正在检查文件…',
    ce_pre_ok_warn: '可以结账，但有带 ⚠ 的项目。请先看一下上面的入口和「各项检查明细」里的说明。',
    ce_pre_ok: '文件齐全，可以结账。',
    ce_pre_block:
      '有缺少或格式错误的文件。请按上面的清单补齐：把文件放进下面的入口即可，放进去后会自动重新检查（直接改了文件夹里的文件时，请重新选择文件夹）。',
    ce_gaps_recheck: '填好了，重新检查',
    ce_gaps_lead_qa:
      '还有 {n} 项设定没定。在这里直接回答，按「保存回答」就写进「{book}」（旧文件留备份，判断人和日期自动记上）。可以只答一部分先保存。用 Excel 直接填的，填好后按「填好了，重新检查」',
    ce_gaps_save: '保存回答',
    ce_gaps_pick: '— 请选择 —',
    ce_gaps_none: '还没有回答任何一项',
    ce_ev_staff_added:
      '已把工时汇总表上的 {names} 加进员工表（旧的公司资料备份：{path}）。身份・出生日期等请回答上面的问题。',
    ce_gaps_saved: '已把 {n} 项回答写进公司资料（旧文件备份：{path}），正在重新检查…',
    ce_gaps_bad: '有的回答写不进去（公司资料没有改动）：{list}',
    ce_gaps_choices: '（可选：{list}）',
    ce_gaps_sheet: '「{sheet}」表',
    ce_gaps_lead:
      '请用 Excel 打开文件夹里的「{book}」，填好下面 {n} 项。「方针」表在选好之后，右边的「判断人」「日期」也要填。保存后点「填好了，重新检查」。',
    ce_pre_gaps: '公司资料里还有没决定的设定（见下面的清单）。',
    ce_pre_engine_err: '引擎读取时发现问题：',
    ce_step_run: '结账',
    ce_step_month: '结账月份',
    ce_step_lang: '底稿语言',
    ce_lang_zh: '中文',
    ce_lang_ja: '日文',
    ce_run: '执行结账',
    ce_p_runtime: '正在下载运行环境（仅首次，约 10〜20 秒）',
    ce_p_packages: '正在加载组件',
    ce_p_engine: '正在准备引擎',
    ce_p_ready: '开始结账',
    ce_p_month: '正在结账 {label}（{i}/{n} 个月）',
    ce_p_workpaper: '正在生成底稿',
    ce_p_elapsed: '已用 {n} 秒',
    ce_p_note: '计算在后台进行，页面不会卡住。请不要关闭本页。',
    ce_disclaimer: '本工具以使用者具备会计判断为前提。法人税等计算表为估算，不是申报书。',
    ce_status_done: '完成',
    ce_err_auth: '没能加载引擎。请重新登录后再试（引擎只对登录的会员开放）。',
    ce_err_bundle: '引擎文件损坏或正在更新，请刷新页面。',
    ce_err_load: '运行环境加载失败。请检查网络，或广告拦截等浏览器扩展后刷新页面。',
    ce_err_no_company:
      '这个文件夹里还没有公司资料。请把「公司资料.xlsx」放进下面的「表格」入口（如果已经有放好资料的文件夹，请重新选那一层：不是它的上一级，也不是 bank 文件夹）。',
    ce_err_no_month: '请选择月份。',
    ce_err_company: '公司数据有问题：',
    ce_err_close: '结账处理中止：',
    ce_err_runtime: '意外错误：',
    ce_summary: '{pass}/{n} 通过・失败 {fail}・未检查 {skip}・不适用 {na}',
    ce_download: '下载底稿（xlsx）',
    ce_checks: '检查结果',
    ce_col_id: '编号',
    ce_col_check: '检查',
    ce_col_status: '结果',
    ce_col_n: '件数',
    ce_st_pass: '通过',
    ce_st_fail: '失败',
    ce_st_skip: '未检查',
    ce_na: '不适用',
    ce_pending: '待确认（{n} 项）',
    ce_col_qid: '编号',
    ce_col_cat: '类别',
    ce_col_item: '事项',
    ce_col_date: '日期',
    ce_col_amount: '金额',
    ce_answers: '回答模板（追加到 decisions.yaml）',
    ce_answers_none: '没有未匹配的银行流水。',
    ce_copy: '复制',
    ce_copied: '已复制',
    ce_sample_line: '先看示例结果：',
    ce_sample_tokyo: '东京虚构公司',
    ce_sample_osaka: '大阪虚构公司',
    ce_sample_banner: '这是虚构公司样本的结果（与真实公司无关）。',
    closing_title: '月结引擎（日本）',
    closing_one:
      '工资、社保、源泉、银行对账、消费税一次结完，输出带检查结果的底稿。数据不离开浏览器。',
    closing_cta: '打开月结引擎',

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
    an_sections_info: '{n} 个章节 · 已选 {sel} 个 · 约 {chars} 字',
    an_chars: '{chars} 字',
    an_chars_sel: '{sel} / {total} 字',
    an_file_reading: '读取中…',
    an_file_error: '错误',
    an_file_scanned: '0 字 — 可能是扫描版 PDF',
    an_remove_title: '移除',
    an_drop_more: '点击继续添加',
    an_skip_limit: '文件数上限为 {max} 个，以下未添加：{list}',
    an_skip_type: '以下格式不支持：{list}',
    an_skip_dup: '以下文件同名，已添加过：{list}',
    an_err_local: '本地环境不可用，请部署后使用。',
    an_err_empty: '分析结果为空。',
    an_err_server: '服务器错误（HTTP {status}）',
    an_err_server_hint: '请减少文件数量，或把问题拆开后重试。',
    an_err_fallback: '（图像解析失败后已自动改用文本解析重试，仍未成功）',
    an_round: '**第 {round}/{max} 轮** · {note}',
    an_reading_pages: '正在读：{pages}',
  },

  en: {
    nav_about: 'About',
    nav_team: 'Team',
    nav_milestones: 'Milestones',
    nav_solutions: 'Solutions',
    nav_products: 'Products',
    nav_demo: 'Applications',
    nav_blog: 'Blog',

    hero_corp: 'Senridoufuu Co., Ltd.',
    home_page_title: 'Senridoufuu Co., Ltd. — Putting AI to real use in everyday work (Osaka)',
    hero_tagline:
      'Every human desire for closeness with AI is nothing but a yearning for resonance of souls.',

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
      'Grounded planning and execution. While holding onto ideals, we honestly pursue achievable paths. That is why we start with online tools that put AI to real use in everyday work, with AI-embedded hardware as the next step.',
    val2_name: 'Clarity',
    val2_desc:
      'Translating complex technology into language and forms everyone can understand. Clear communication is the foundation of trust. We tell you plainly what the AI does and where your data goes.',
    val3_name: 'Responsibility',
    val3_desc:
      'Those with the power of technology must be responsible for how it is used. We are committed to the ethical application of AI. The final judgement stays with the people who use our tools, and results are always delivered in a form a person can check.',

    showcase_eyebrow: 'Products & Solutions',
    showcase_title: 'Turning imagination into reality.',
    showcase_lead:
      'From digital assistants to physical companions — exploring what AI can do in real settings.',
    showcase_app_tag: 'Solution',
    showcase_app_desc:
      'AI reads PDF and Excel purchase orders and turns them into an order ledger. Try it free, no sign-up needed.',
    showcase_hw_tag: 'Product',
    showcase_hw_desc:
      'Bringing generative AI into toys, learning tools and IoT devices as everyday companions. Currently in development.',
    showcase_more: 'All products & solutions',
    journal_eyebrow: 'Journal',
    journal_title: 'Recording the journey, sharing our thinking.',
    journal_lead: 'On technology, products, and the changing relationship between people and AI.',
    journal1_tag: 'Perspectives',
    journal1_name: 'Perspectives',
    journal1_desc: 'Thoughts on AI, society and the future.',
    journal2_tag: 'Building',
    journal2_name: 'Development notes',
    journal2_desc: 'An honest record from concept and experiment to finished product.',
    journal3_tag: 'Updates',
    journal3_name: 'Company news',
    journal3_desc: 'Project progress, partnership news and everyday life at the company.',
    journal_more: 'Read all posts',
    about_teaser_eyebrow: 'About',
    about_teaser_title: 'From Osaka, exploring new ways to connect people and AI.',
    about_teaser_body:
      'Senridoufuu Co., Ltd. is an Osaka-based company researching AI and putting it to practical use. Today we provide online AI tools and business automation, and are developing hardware with generative AI built in as the next step.',
    about_teaser_cta: 'Meet the team',

    nav_member: 'Member',
    demo_member_badge: 'Members Only',

    footer_tagline:
      'Every human desire for closeness with AI is nothing but a yearning for resonance of souls.',
    footer_nav_heading: 'Navigation',
    footer_contact_heading: 'Contact',
    nav_privacy: 'Privacy Policy',
    nav_consult: 'Free consultation',
    nav_company: 'Company',
    contact_page_title: 'Free Consultation & Contact',
    contact_eyebrow: 'Contact',
    contact_title: 'Free consultation',
    contact_lead:
      'Questions about using AI, automating your work, or our tools — whatever the topic, feel free to ask. We reply within 1 business day, free of charge.',
    contact_mail_pre: 'Or email us: ',
    footer_copy: '© 2025 Senridoufuu Co., Ltd.',
    addr_street: '4-9-7, Nishimikuni 4-chome, Yodogawa-ku',
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

    company_page_title: 'Senridoufuu — Company Profile',
    company_eyebrow: 'Company',
    company_title: 'Company Profile',
    co_name_h: 'Company name',
    co_name_v: 'Senridoufuu Co., Ltd. (千里同風株式会社)',
    co_est_h: 'Established',
    co_rep_h: 'Representative',
    co_rep_v: 'Yuki Minami, Representative Director',
    co_addr_h: 'Address',
    co_addr_v: '4-4-9-7 Nishimikuni, Yodogawa-ku, Osaka 532-0006, Japan',
    co_biz_h: 'Business',
    co_biz1: 'AI research and information services',
    co_biz2: 'Consulting on AI-driven business improvement and efficiency; cloud services',
    co_biz3: 'Planning, development and sale of software and hardware',
    co_biz4: 'Contract market research and management consulting',
    co_contact_h: 'Contact',
    co_contact_cta: 'Free consultation form',
    milestones_page_title: 'Senridoufuu — Milestones',
    milestones_eyebrow: 'Milestones',
    milestones_title: 'Our Journey',
    milestones_body:
      "A look at the key moments in Senridoufuu's history, from founding to the present.",
    ms1_event: 'Company founded',
    ms1_desc: 'Founded in Osaka to research AI and plan products and services with AI built in.',
    ms2_event: 'Official website launched',
    ms2_desc:
      'Launched the official website, together with our first AI tool: Chinese–Japanese translation.',
    ms3_event: 'Online AI tools released',
    ms3_desc:
      'Released document analysis, life-story interviews, Japanese verb conjugation, Osaka bid monitoring and Chinese proofreading, one after another.',
    ms4_event: 'Order-to-ledger demo launched',
    ms4_desc:
      'Started business automation for small and mid-sized companies: AI that turns order forms into an order ledger.',

    solutions_page_title: 'Senridoufuu — Solutions',
    solutions_eyebrow: 'Solutions',
    solutions_title: 'Products & Services',
    // ── Order-form → sales ledger landing (lead-gen Stage A) ──
    o2l_page_title: 'Order Automation',
    o2l_card_title: 'Orders · Excel automation',
    o2l_card_desc:
      'Upload an order form (PDF / Excel) and AI structures it into a ledger. Try it free.',
    o2l_card_cta: 'Try it',
    o2l_eyebrow: 'Order Automation',
    o2l_hero_title: 'Still typing order forms by hand?',
    o2l_hero_lead:
      'AI turns your PDF and Excel order forms into a sales ledger automatically — no more daily re-typing and checking.',
    o2l_hero_cta: 'Try it free',
    o2l_hero_cta_note: 'Once without signing up, three times when you register.',
    o2l_flow_eyebrow: 'Sound familiar?',
    o2l_flow_title: 'Copying order forms into a ledger, every day',
    o2l_before_label: 'How it works now',
    o2l_before_1: 'A PDF or Excel order form arrives from a client',
    o2l_before_2: 'You check it by eye',
    o2l_before_3: 'You type it into the ledger, line by line',
    o2l_before_4: 'You cross-check for entry mistakes',
    o2l_after_label: 'With automation',
    o2l_after_1: 'Upload the order form',
    o2l_after_2: 'AI reads the contents',
    o2l_after_3: 'The sales ledger is built automatically',
    o2l_after_4: 'You just review, then download as Excel',
    o2l_pain_eyebrow: 'Common frustrations',
    o2l_pain_title: 'Is this manual work weighing you down?',
    o2l_pain1_title: 'Hours lost to re-typing',
    o2l_pain1_desc: 'On busy days, ledger entry alone takes hours — leaving no time for real work.',
    o2l_pain2_title: 'Mistakes and cross-checking',
    o2l_pain2_desc:
      'Manual entry invites wrong quantities and prices, and the checking afterward is unavoidable.',
    o2l_pain3_title: 'Every client, a different format',
    o2l_pain3_desc: 'Formats templates cannot handle, AI reads from context.',
    o2l_demo_eyebrow: 'Try it',
    o2l_demo_title: 'Convert your own order form, live',
    o2l_demo_lead:
      'Choose an order form (PDF / Excel / CSV) and it is converted into ledger form. Files are read in your browser; the files themselves are never sent to our servers.',
    o2l_drop_text: 'Drop order forms (PDF / Excel / CSV) here, or click to choose (up to 10)',
    o2l_drop_hint:
      'Files are read in your browser (the files themselves are not sent). Scans / images are sent as images for reading (we ask first).',
    o2l_sample_btn: 'Try with a sample order',
    o2l_drop_title: 'Choose files',
    o2l_sample_view: 'View the sample (PDF)',
    o2l_ai_send_note:
      'When you press “Structure into a ledger with AI”, only the extracted text is sent to an AI via our server (the file itself is not sent).',
    o2l_ai_route_label: 'AI used:',
    o2l_file_image: 'image',
    o2l_ai_cancelled: 'Image sending was cancelled.',
    o2l_ai_vision_pending:
      'OCR for images / scans is being set up. Text-based PDF, Excel, and CSV files work as usual.',
    o2l_cf_title: 'Read this as an image?',
    o2l_cf_body:
      'This file has no text, so it will be read as an image. The image itself is then sent via our server to the AI shown in the demo section. (For text PDF / Excel / CSV, the file itself is not sent.)',
    o2l_cf_ok: 'Send and read',
    o2l_cf_cancel: 'Cancel',
    o2l_status_parsing: 'Reading…',
    o2l_err_toobig: 'File is too large (up to 5MB).',
    o2l_err_type: 'Unsupported file type (PDF / Excel / CSV).',
    o2l_err_parse: 'Could not read the file. Please try another.',
    o2l_err_scanned:
      'This PDF has no text layer (looks like a scan or photo). For now only text-based PDF / Excel / CSV are supported (scanned support coming soon).',
    o2l_badge_local: '✓ Processed entirely in your browser',
    o2l_download: 'Download as Excel',
    o2l_result_note:
      'Above are the files read. “Structure with AI” structures each and merges them into one downloadable table.',
    o2l_files_skipped: 'Skipped (unreadable):',
    o2l_ai_btn: 'Structure into a ledger with AI (free)',
    o2l_ai_working: 'AI is structuring…',
    o2l_ai_disabled:
      'AI structuring is coming soon. You can download the raw reading from the table above.',
    o2l_ai_anon_used: 'You have used your free try (1). Register to get 3 more.',
    o2l_ex_eyebrow: 'Example',
    o2l_ex_title: 'This order form becomes this ledger',
    o2l_ex_lead: 'The actual result of structuring a fictional sample order form with AI.',
    o2l_ex_before: 'Before: order form (PDF)',
    o2l_ex_after: 'After: order ledger (downloadable as Excel)',
    o2l_ex_img_alt:
      'Sample order form (from Sample Shoji Co. to Osaka Sample Oroshi Co., 5 line items)',
    o2l_ex_p1:
      'The customer is read from the sender, not confused with the addressee marked “onchu” (your company).',
    o2l_ex_p2: 'Subtotal, tax and total are not line items, so they do not become ledger rows.',
    o2l_ex_p3: 'A delivery date set on a line (row 5) takes priority over the header date.',
    o2l_ex_note:
      '* Some layouts may be misread. Always check the content before downloading. (Notes column hidden here.)',
    o2l_faq_eyebrow: 'FAQ',
    o2l_faq_title: 'Questions we often get before you start',
    o2l_faq_q1: 'How accurate is it?',
    o2l_faq_a1:
      'On our own sample order form, we have confirmed in production that the customer, item code, quantity, unit price, amount and delivery date all match the correct answer. Some layouts may still be misread, so please always have a person check before downloading. For a custom build, we tune it while checking against your actual order forms.',
    o2l_faq_q2: 'Which files are supported?',
    o2l_faq_a2:
      'PDF, Excel and CSV files that contain text. Reading scanned documents and photos (images) is not available yet while we verify its accuracy.',
    o2l_faq_q3: 'Can it connect to Yayoi or my sales management software?',
    o2l_faq_a3:
      'Direct integration (API) is not supported at the moment. We deliver Excel files in the import format of the software you use.',
    o2l_faq_q4: 'Is it safe to send my customers’ order data?',
    o2l_faq_a4:
      'Files are read in your browser, and the files themselves are not sent. Only when you press “Structure into a ledger with AI” is the extracted text sent to an AI via our server, and our servers do not store it. The AI in use is shown in the demo section. See our Privacy Policy for details.',
    o2l_faq_q5: 'How soon will I hear back after contacting you?',
    o2l_faq_a5: 'We reply within 1 business day. Consultation is free.',
    o2l_faq_q6: 'What does the price include?',
    o2l_faq_a6:
      'Requirements discussion, agreeing the input (order form) and output (ledger / import Excel) formats, delivery of the finished tool, and up to 2 revisions. Maintenance and improvements are optional and billed monthly.',
    o2l_faq_q7: 'How long does delivery take?',
    o2l_faq_a7:
      'Once we have all the relevant files, we deliver the first version of the ledger in as little as 1 business day. The completion date, including adjustments, is agreed with you depending on the work.',
    o2l_ai_register_link: 'Register for free →',
    o2l_ai_member_used: 'You have used your 3 free tries. Please get a free consultation.',
    o2l_ai_daily: 'Today’s free trial limit has been reached. Please try again later.',
    o2l_ai_toobig: 'The file is large, so only the first part was processed in the free trial.',
    o2l_ai_error: 'Structuring failed. Please try again shortly.',
    o2l_ai_login: 'Getting ready — please reload the page and try again.',
    o2l_ledger_done: '✓ AI structured it into a ledger',
    o2l_ledger_download: 'Download ledger as Excel',
    o2l_price_eyebrow: 'Pricing',
    o2l_price_title: 'Start small, pay for what you need',
    o2l_price_free_title: 'Free trial first',
    o2l_price_free_price: '¥0',
    o2l_price_free_desc: 'Once without registering, three times when you sign up.',
    o2l_price_paid_title: 'Small-scale automation',
    o2l_price_paid_price: 'From ¥50,000',
    o2l_price_paid_desc:
      'Built to fit your order forms and ledger. Includes requirements discussion, agreeing the input and output formats, delivery of the finished tool, and up to 2 revisions. Start with a free consultation.',
    o2l_price_maint: 'Maintenance and improvements from ¥5,000/month (optional).',
    o2l_trust_eyebrow: 'So you can use it with confidence',
    o2l_trust_title: 'How your data is handled',
    o2l_trust1:
      'Files are read in your browser; the files themselves are never sent to our servers.',
    o2l_trust2:
      'Only when you press “Structure into a ledger with AI” is the extracted text sent to an AI via our server (scans / images are sent as images, and we ask first). The AI in use is shown in the demo section.',
    o2l_trust3: 'Our servers do not store the content you send.',
    o2l_trust4: 'All communication is encrypted (HTTPS).',
    o2l_trust_privacy: 'See our Privacy Policy for full details.',
    o2l_cta_title: 'Tell us how you work today.',
    o2l_cta_lead: 'Try it for free, or talk to us about automation tailored to your business.',
    o2l_cta_try: 'Try it free',
    o2l_cta_consult: 'Get a free consultation',
    o2l_consult_title: 'Tell us about your workflow',
    o2l_consult_lead:
      'Describe your current process or the problem you want to solve. We will reply within 1 business day. No charge.',
    o2l_f_name: 'Your name',
    o2l_f_company: 'Company (optional)',
    o2l_f_email: 'Email address',
    o2l_f_message: 'What would you like help with?',
    o2l_f_submit: 'Send',
    o2l_f_sending: 'Sending…',
    o2l_f_ok: 'Sent. We will reply within 1 business day. Thank you.',
    o2l_f_invalid: 'Please check your name, email, and message.',
    o2l_f_error: 'Sending failed. Please try again later.',
    o2l_f_privacy_pre: 'By submitting, you agree to our ',
    o2l_f_privacy_link: 'Privacy Policy',
    o2l_f_privacy_post: '.',
    pp_eyebrow: 'Privacy',
    pp_title: 'Privacy Policy',
    pp_updated: 'Effective date: October 5, 2026 / Revised: October 6, 2026',
    pp_intro:
      'Senridoufuu Co., Ltd. ("we", "us") handles your personal information on our website (senridf.com) and across our tools and services in accordance with the policy below.',
    pp_s1_h: '1. Information we collect',
    pp_s1_b:
      'We may collect: (1) the name, company, email address, and message you enter in our inquiry/consultation form; (2) your email address if you register an account; (3) usage data (access times, pages viewed, approximate usage counts); and (4) content you enter or upload into our tools (see Section 4 for how it is processed).',
    pp_s2_h: '2. How we use it',
    pp_s2_b:
      'We use this information to respond to inquiries, follow up on consultations and quotes, provide and improve our services, and prevent abuse. We do not use it beyond these purposes without your consent.',
    pp_s3_h: '3. External services and third parties',
    pp_s3_b:
      'We do not sell or disclose your personal information to third parties except as required by law. However, to provide our services we use the following external services, and data is sent to them to the extent needed for processing.',
    pp_s3_qwen:
      'Generative AI (Alibaba Cloud "Tongyi Qianwen" / DashScope) — used for AI processing such as translation and document formatting.',
    pp_s3_sf:
      'Generative AI (SiliconFlow, operated by SILICONFLOW LABS PTE. LTD. [Singapore]; model: Google Gemma 4) — used for AI structuring and image reading in the order-to-ledger demo. The AI actually in use is shown in the demo section. Images/scans are sent only after you agree via a confirmation dialog.',
    pp_s3_google: 'Google / Firebase — used for login authentication and data storage (Firestore).',
    pp_s3_cf: 'Cloudflare — used for website delivery and access analytics.',
    pp_s3_dg:
      'Deepgram — used to transcribe speech to text when you use the voice interpretation feature.',
    pp_s4_h: '4. In-browser processing',
    pp_s4_b:
      'In some tools, such as the order-to-ledger demo, PDF, Excel, and CSV files that contain text are parsed within your browser, and the files themselves are not sent to our servers. Only when you use “Structure with AI” is the extracted text (or, for images and scans, the image, after your confirmation and consent) sent via our server to the generative AI listed above. Our servers do not store that content.',
    pp_s5_h: '5. Retention',
    pp_s5_b:
      'Inquiry and consultation content is retained for handling and necessary records. Statistical data such as access analytics is automatically deleted after a set period. Personal information that is no longer needed is erased by appropriate means.',
    pp_s6_h: '6. Your rights',
    pp_s6_b:
      'You may request disclosure, correction, deletion, or suspension of use of your personal information. To do so, please contact us at the address below. We will respond in accordance with the law after verifying your identity.',
    pp_s7_h: '7. Cookies and analytics',
    pp_s7_b:
      'Our site may use cookies or similar technologies and access analytics to improve usability and understand usage. These do not contain information that directly identifies you.',
    pp_s8_h: '8. Contact and business information',
    pp_s8_b:
      'For inquiries about this policy and requests regarding the handling of personal information, please contact us below.',
    pp_biz_name: 'Business name',
    pp_biz_rep: 'Representative',
    pp_biz_addr: 'Location',
    pp_biz_contact: 'Contact',
    pp_biz_addr_val: 'Osaka, Japan',
    pp_s9_h: '9. Changes to this policy',
    pp_s9_b:
      'We may revise this policy in response to changes in law or improvements to our services. We will announce significant changes on this page.',
    solutions_body:
      'We start with online tools that put AI to real use in everyday work, and are developing hardware with generative AI built in as the next step.',
    sol_now_eyebrow: 'Available now',
    sol_now_title: 'AI tools you can use today',
    sol_feat_tag: 'Business automation',
    sol_feat_p1: 'Try it right away with a sample order form, no sign-up',
    sol_feat_p2: 'Custom builds for your formats from ¥50,000',
    sol_feat_p3: 'We reply to inquiries within 1 business day',
    sol_feat_cta: 'Learn more and try it free',
    sol_more_pre: 'Other AI tools (translation, document analysis, Japanese learning) are in the ',
    sol_more_link: 'all applications',
    sol_more_post: '.',
    sol_dev_eyebrow: 'In development',
    sol_dev_title: 'Hardware with AI built in',
    sol_dev_badge: 'In development',
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

    demo_page_title: 'Senridoufuu — Applications',
    demo_eyebrow: 'Applications',
    demo_title: 'Applications',
    demo_intro:
      'AI apps we build, ready to use right in your browser. Each app is updated as we go.',

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

    bids_title: 'Osaka City Bid Monitor',
    bids_desc:
      'Automatically scrapes daily service and goods-procurement notices published by Osaka City, with Chinese summaries to quickly filter projects suited to small businesses.',
    bids_cta: 'View Bids',

    /* Function tags (classified by capability, not by B2B/B2C; tools carry several) */
    tag_all: 'All',
    tag_speech: 'Speech Input',
    tag_translate: 'Translation',
    tag_docs: 'Document Parsing',
    tag_generate: 'Generation',
    tag_verify: 'Verification',
    tag_scrape: 'Scraping',
    tag_dict: 'Dictionary',
    tag_empty: 'No tools match that tag.',
    tag_status: 'Showing {n} of {total} tools.',
    badge_open: 'No Login',
    /* One-liners for the cards; the long copy lives on each tool page */
    tl_one: 'Chinese and Japanese both ways, with back-translation shown for checking.',
    analysis_one: 'Cross-analyze multiple PDF, Word and Excel files into one report.',
    proofreader_one:
      'Finds typos, repeated sentences and internal contradictions, reported by category.',
    lifestory_one: 'Answer about 100 questions; AI writes your life story as a book.',
    japanese_one: '214 common verbs with auto-generated conjugations. No login needed.',
    bids_one: 'Daily Osaka City tender notices, each summarized in Chinese.',

    blog_page_title: 'Senridoufuu — Blog',
    blog_eyebrow: 'Blog',
    blog_title: 'Insights',
    blog_intro:
      'Notes on AI, hardware, and the Japanese market — our observations and discoveries.',
    blog_empty: 'Articles coming soon.',
    /* Blog tags (fixed map; unregistered tags render as typed) */
    blog_tag_ai_hardware: 'AI & Hardware',
    blog_tag_research: 'Market Research',
    blog_tag_product: 'Product Development',
    blog_tag_news: 'News',
    blog_tag_tech: 'Engineering Notes',

    tl_page_title: 'Senridoufuu — Translation & Interpretation Tool',
    tl_eyebrow: 'Translation & Interpretation',
    tl_title: 'Chinese ⇄ Japanese · Live Interpretation',
    tl_lead:
      'Text translation and real-time voice interpretation — suitable for lectures and meetings.',
    tl_input_label: 'Input',
    tl_input_placeholder: 'Enter Chinese or Japanese…',
    tl_notice: 'Translation is unavailable in local preview. Please try it on the deployed site.',
    tl_output_placeholder: 'The translation will appear here',
    tl_voice_feed_empty: 'Press “I speak” or “They speak” to start interpreting',
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
    tl_back_unverified:
      '⚠ Back-translation check failed — this line is unverified; please say it again',
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
    tl_marker_recording: '● Recording',
    tl_confirm_clear: 'Clear the record?',
    tl_confirm_new_meeting: 'Clear the transcript?',
    tl_speak_title: 'Read aloud',
    tl_generating: 'Generating…',
    tl_local_no_voice: 'Voice features are not available in the local environment.',
    tl_connecting: 'Connecting…',
    tl_ws_error: 'A WebSocket error occurred.',
    tl_mic_denied: 'Microphone access was denied. Please allow it in your browser settings.',
    tl_no_speech: 'No speech was recognized. Please check your microphone input and permissions.',
    tl_err_download: 'The download failed. Please try again.',
    tl_err_no_transcript: 'There is no transcript yet, so a summary cannot be generated.',
    tl_err_summary: 'The summary could not be generated ({msg}). Please try again later.',
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

    /* Life story tool (trilingual since 2026-08-17. ⚠️ The question bank is NOT
       translated — see docs/tools/04-lifestory.md for why) */
    ls_page_title: 'Life Story · Senridoufuu',
    ls_back: '← Back',
    ls_hdr_title: 'Life Story',
    ls_btn_gen: 'Write my story',
    ls_w_title: 'Record your story',
    ls_w_desc: 'When you feel you have said enough, the AI will write your biography.',
    ls_w_desc1: 'I will ask you some questions. Answer by typing or speaking.',
    ls_w_desc2: 'You do not have to finish in one sitting — you can stop any time.',
    ls_btn_start: 'Start →',
    ls_btn_prev_story: 'View your last story',
    ls_loading_msg: 'Thinking of the next question…',
    ls_mic_lbl: 'Voice input',
    ls_recording: 'Recording… {n}s',
    ls_reconnecting: 'Reconnecting… ({n}/2)',
    ls_char_ct: '{n} characters',
    ls_btn_skip: 'Skip this one',
    ls_btn_submit: 'Submit answer →',
    ls_btn_continue: 'Continue →',
    ls_bw_title: "Let's pause here",
    ls_btn_more: 'Keep answering',
    ls_btn_rest: 'Stop for now',
    ls_story_hdr_title: 'My life story',
    ls_btn_back: '← Back',
    ls_export: 'Export',
    ls_import: 'Import',
    ls_reset: 'Reset',
    ls_export_title: 'Export all data as JSON',
    ls_import_title: 'Restore data from a JSON file',
    ls_reset_title: 'Delete all data — cannot be undone',
    ls_gen_summary: 'Your story will be written from {n} answers',
    ls_gen_summary_cats: ', spanning {n} themes.',
    ls_gen_confirm: 'Generate it now?',
    ls_writing: 'Writing your story',
    ls_writing_note: 'This may take 30–60 seconds…',
    ls_regenerate: 'Try again',
    ls_q_num: 'Question {n}',
    ls_restored: '✓ Found an unsubmitted answer and restored it for you.',
    ls_need_answer: 'Please write your answer first, or choose "Skip this one".',
    ls_understanding: 'Reading your answer…',
    ls_submit_failed: 'Submission failed: ',
    ls_retry: 'Retry',
    ls_clear_filter_continue: 'Clear the filter and continue',
    ls_gen_story: 'Write the story',
    ls_today_enough: "That's enough for today",
    ls_or_pick_theme: 'Or answer questions on one theme only:',
    ls_only_theme: '{cat} only',
    ls_all_continue: 'Continue with all →',
    ls_filtered: 'Filtered: only questions about {theme}',
    ls_clear_filter: 'Clear the filter',
    ls_no_data: 'There is no data to export.',
    ls_downloaded: '✓ Data downloaded',
    ls_confirm_import:
      'About to import {n} answers. Your current data will be overwritten. Continue?',
    ls_confirm_overwrite:
      'You already have {n} answers. Overwrite, or merge? (Cancel = abort the import)',
    ls_imported: '✓ Imported {n} answers. The page will reload.',
    ls_import_failed: 'Import failed: ',
    ls_confirm_reset: 'Delete all answers and data? This cannot be undone.',
    ls_no_speech: 'Your browser does not support voice input. Please use Chrome or Edge.',
    ls_hint_short: 'A bit short — the AI may not have enough to work with. Could you add more?',
    ls_hint_ok: '✓ Good length',
    ls_hint_long: '⚠ Slightly long; you could tighten it',
    ls_hint_too_long: 'Too long — aim for 200–400 characters',
    ls_answered: '{n} answered',
    ls_remaining: ' · {n} to go',
    ls_welcome_back: 'Welcome back',
    ls_that_place: 'there',
    ls_cat_origin: 'Origins',
    ls_cat_family: 'Family',
    ls_cat_growing: 'Growing up',
    ls_cat_work: 'Work',
    ls_cat_turning: 'Turning points',
    ls_cat_bonds: 'Relationships',
    ls_cat_setback: 'Setbacks',
    ls_cat_passion: 'Passions',
    ls_cat_inner: 'Inner life',
    ls_cat_values: 'Values',
    ls_cat_money: 'Money',
    ls_cat_influence: 'Influence',
    ls_cat_regret: 'Regrets',
    ls_cat_mark: 'Being remembered',
    ls_cat_legacy: 'Legacy',
    api_bad_gateway:
      'The server could not handle the request (HTTP {status}). This response did not come from our service — usually an upstream timeout or a platform-level block. Please try again shortly.',
    api_not_found:
      'Endpoint not found (HTTP {status}). This is most likely a deployment or routing problem, not something you did.',
    api_not_json:
      'The server returned something unexpected (HTTP {status}). This response did not come from our service.',
    ls_answer_placeholder: 'Write your answer here…',
    ls_privacy_note: '({n} of them are marked private and will not be analysed)',
    ls_gen_timeout: 'Timed out — the server took too long. Please try again shortly.',
    ls_gen_failed: 'Could not generate the story: ',
    ls_loading_first: 'Getting a question ready…',
    ls_all_answered: "You've answered every question.",
    ls_can_gen_now: '{n} answered. You can make the story now, or keep going.',
    ls_soft_landing:
      'That’s alright — some things are better kept to yourself.\nLet’s talk about something else.',
    ls_well_done: 'Well done',
    ls_good_pause: 'This is a good place to pause',
    ls_shared_n: "You've shared {n} pieces of your story.",
    ls_come_back: 'Come back any time — your answers are saved.',
    ls_bad_format: 'Bad data format: missing the answers array',
    ls_sum_shared: "You've shared {n} pieces of your story",
    ls_sum_themes: 'across {c} themes, about {n} characters.',
    ls_sum_ready: 'Ready to keep going?',
    ls_theme_done:
      "You've answered every question under “{cat}”. Keep going with another theme, or make the story?",
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
    pf_show_dismissed: 'Show dismissed ({n})',
    pf_hide_dismissed: 'Hide dismissed ({n})',
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
    ce_ev_h: 'Evidence (photos & PDFs)',
    ce_ev_intro:
      'Add receipts, invoices and tax slips as photos or PDFs. The text is read on this computer (images are never uploaded) and a draft with date, amount and party is made. Confirm it to enter it in the index, searchable by date, amount and party (the search rule of the Electronic Books Act). Originals are kept unchanged in evidence/ in the working folder.',
    ce_ev_need_folder:
      'Evidence needs the folder opened with “Choose working folder” (originals and the index are written there).',
    ce_ev_add_paper: 'Add paper documents (photos/scans)',
    ce_ev_add_elec: 'Add files received electronically',
    ce_ev_kinds:
      '“Paper” is a photo or scan of a paper document; “electronic” is data received by email, download or online banking (it must be kept as data). The page guesses the type from how the file is built: an invoice someone scanned and emailed looks like paper but counts as electronic. Correct it when you confirm. On confirmation the original moves into the folder for its type.',
    ce_ev_paper_notice:
      'Photos of paper documents are working copies. This tool does not meet the scanner-storage requirements (a certified timestamp), so keep the paper originals for 7 years (NTA Q&A on scanner storage, Q31, Q32, Q59).',
    ce_ev_drafts:
      '{n} draft(s) not confirmed yet. Check the date, amount and party and confirm (drafts are not used in the books).',
    ce_ev_q_date: 'Date',
    ce_ev_q_amount: 'Amount',
    ce_ev_q_party: 'Party',
    ce_ev_err_need:
      'Fill in {list} before confirming (the e-bookkeeping law requires date, amount and party)',
    ce_ev_q_void: 'Include cancelled',
    ce_ev_search: 'Search',
    ce_ev_clear: 'Clear',
    ce_ev_col_code: 'Attachment no.',
    ce_ev_code_title:
      'The number written at the top right of the paper (like E2604-07). The grey text is the suggested next number',
    ce_ev_code_save: 'Save number',
    ce_ev_col_status: 'Status',
    ce_ev_col_doc: 'Document',
    ce_ev_col_file: 'File',
    ce_ev_col_bank: 'Bank row',
    ce_ev_empty: 'No evidence yet.',
    ce_ev_st_draft: 'Draft',
    ce_ev_st_ok: 'Confirmed',
    ce_ev_st_void: 'Cancelled',
    ce_ev_kind_paper: 'Paper',
    ce_ev_kind_elec: 'Electronic',
    ce_ev_confirm: 'Confirm',
    ce_ev_fix: 'Edit',
    ce_ev_void: 'Cancel',
    ce_ev_reason_ok: 'OK',
    ce_ev_reason_need: 'Enter a reason',
    ce_s_note: '⚠ See the note below',
    ce_c_book_d:
      'Company, employees, opening balances, fixed assets and so on, one sheet per topic.',
    ce_c_bank_t: 'Bank statements',
    ce_c_bank_d:
      'Put the CSV or Excel files from online banking in as they are. They must run to the end of the month you are closing.',
    ce_pick_tip:
      'The folder dialog shows folders only, so not seeing your files there is normal. Open the working folder, then press “Select Folder”.',
    ce_list_toggle: 'Check details (11 items)',
    ce_rp_title: 'Bank rules: dry run',
    ce_rp_sum_ok: ' ({n} rules, {rows} rows)',
    ce_rp_sum_warn: ' (⚠ {w} to review)',
    ce_rp_intro:
      'The rules on the “{sheet}” sheet were tried against the {rows} statement rows in the closing period ({first} to {last}). You can fix the rules before closing.',
    ce_rp_norules:
      'There are no rules on the “{sheet}” sheet yet. Closing works without them (you will be asked about each row).',
    ce_rp_unused:
      '{n} rule(s) match no row. Check that the text to look for is exactly what the statement shows (keep half-width kana as is).',
    ce_rp_multi:
      '{n} row(s) match two or more rules. The close will not guess; it asks about each one. Change the rules so that only one matches.',
    ce_rp_answered: 'answered',
    ce_rp_hits: 'Rows matched by each rule',
    ce_rp_n: '{n} row(s)',
    ce_rp_more: '{n} more',
    ce_rp_n_total: '{n} row(s), total {a}',
    ce_rp_none_pre:
      'Rows without a rule are listed here after closing. Payroll, social insurance and tax payments and transfers between your own accounts are matched automatically and need no rule.',
    ce_rp_none_zero: 'No rows are missing a rule.',
    ce_rp_none:
      '{n} row(s) have no rule ({k} different descriptions). For descriptions that come back every month, add a rule on the “{sheet}” sheet and they are booked automatically next time.',
    ce_ev_reason_fix: 'Reason for changing a confirmed row (kept in the correction log)',
    ce_ev_reason_void:
      'Reason for cancelling (the row and the original are kept, and the reason is logged)',
    ce_ev_dup: '{name} is already in (same content)',
    ce_ev_err_read:
      'Could not read {name}: {msg} (the original is saved; fill in the draft by hand)',
    ce_ev_reading:
      'Reading {name} (file {i}/{n}, page {p}/{pn}) — photos take about 10–60 s per page',
    ce_ev_done: 'Read {n} page(s) ({s} s)',
    ce_ev_ocr: 'Read text in photos and scans',
    ce_z_queued: 'These {n} file(s) will be handled after the files before them',
    ce_ev_queued: 'These {n} file(s) will be read after the files before them',
    ce_ev_preparing:
      'Preparing {name} (file {i}/{n}) — getting the reading helper and tools ready; if the tables are still being checked, this waits until that finishes',
    ce_ev_helper_idle:
      'On Windows, start the local reading helper first: it reads every page in about 1 s per page (images never leave this computer). Without it, only the first page is read inside the browser (10–60 s per page, with a heavy load on the computer meanwhile).',
    ce_ev_rereading:
      'Re-reading in the background ({i}/{n}): {name}, page {p} — the kind of document was recognised but the cross-check failed, so the browser reads it once more (1–2 min per page). You can confirm the other drafts meanwhile',
    ce_ev_reread_sum:
      '{r} page(s) failed the cross-check and were read again in the browser ({b} of them used the second reading)',
    ce_ev_helper_on:
      'Reading with the local helper ({v}): about 1 s per page, all pages. Pages whose kind is recognised but whose cross-check fails are read once more in the browser after all pages (1–2 min per page)',
    ce_ev_helper_off:
      'The local reading helper is not running. Double-click start-ocr-helper.cmd and keep its window open. This time only the first page is read inside the browser (10–60 s per page, with a heavy load on the computer meanwhile)',
    ce_ev_helper_lost:
      'The local reading helper stopped part way ({msg}). The remaining scanned pages were not read (the originals are saved). Start the helper again and add the files once more',
    ce_ev_reading_fast: 'Reading {name} (file {i}/{n}, page {p}/{pn})',
    ce_ev_ocr_d:
      'Fully cross-checked kinds: electricity bills, Osaka City water bills, pension premium notices, local tax payment slips (QR) and Chinese e-fapiao. Other documents (receipts, invoices, contracts and so on) are read for date, amount and party from their wording, but cannot be cross-checked, so compare them with the original. PDFs with a text layer are read at once either way.',
    ce_ev_pages: '({n} pages)',
    ce_ev_done_noocr:
      'Saved {f} file(s) without reading text in photos or scans (read {n} page(s) of PDFs with text, {s} s)',
    ce_ev_skipped: '{name}: saved without reading the photo or scan (reading is unticked)',
    ce_wp_ok:
      '✓ {name} → opening balances ({n} rows, as of {as_of}), company name, fiscal year end and first month ({start}) were taken from the workpaper into the company workbook (previous file: {path})',
    ce_wp_ok_new:
      '✓ {name} → a company workbook was created from the workpaper: opening balances ({n} rows, as of {as_of}), company name, fiscal year end and first month ({start}). The checks below say what is still missing',
    ce_wp_check_ok:
      '{name}: the total assets read agree with the balance sheet in the workpaper ({total} yen)',
    ce_wp_check_ng:
      '△ {name}: the total assets read ({computed} yen) do not agree with the balance sheet in the workpaper ({total} yen). Check the opening balances',
    ce_wp_added:
      '{name}: accounts not in the chart were registered on the Extra accounts sheet: {list}',
    ce_wp_guessed:
      '△ {name}: for some accounts the section was set from the balance direction ({list}). Check the section on the Extra accounts sheet',
    ce_wp_rounding:
      '{name}: amounts below one yen in the workpaper were rounded (the {r} yen moved went to retained earnings)',
    ce_wp_err_prior_year:
      '✗ {name}: this year has balances at the start, but the journal has no breakdown of them. Add the workpaper of the previous year, or Yayoi Kaikei opening-balance data',
    ce_wp_err_no_journal:
      '✗ {name}: this is a workpaper, but no journal sheet (with account, detail, debit and credit headings) was found',
    ce_wp_err_no_bs:
      '✗ {name}: this is a workpaper, but no balance sheet was found (the year end and total assets are read from it)',
    ce_wp_err_start:
      '✗ {name}: the month after the year end of the workpaper ({day}) differs from the first month in the company workbook ({start}). Correct one of them',
    ce_z_workpaper:
      '△ {name}: this is a financial workpaper (annual), not the company workbook, so it was not saved. The tool cannot read workpapers yet. For opening balances, copy the closing balances from the balance sheet in the workpaper to the Opening balances sheet, or add Yayoi Kaikei opening-balance data.',
    ce_ev_attached: 'Linked to this row',
    ce_ans_credit_h: 'Who paid (credit)',
    ce_ans_credit: 'Credit account (未払金 for an advance)',
    ce_ans_err_credit: 'Choose the credit account',
    ce_sg_same:
      'Prefilled from {n} earlier row(s) with the same description, booked to “{acc}” (latest {last}) — check and save',
    ce_sg_similar:
      'Prefilled from {n} earlier row(s) to the same party (e.g. {desc}), booked to “{acc}” (latest {last}) — check and save',
    ce_sg_far:
      'Rows to this party were booked to “{acc}”, but the amount is far from before ({amounts}) — it may be a different kind of payment, so nothing was prefilled',
    ce_sg_use: 'Use this account',
    ce_sg_alts:
      'Rows like this were booked to different accounts before, so this one cannot be decided — choose:',
    ce_chip_bank_short: 'Statement ends {d} (month end not checked)',
    ce_k_cash_short: 'Statement ends {d}; month end not checked',
    ce_fx_jm_mode: 'Resident tax through payroll',
    ce_fx_opt_special: 'Yes (enter the monthly amount on the notice)',
    ce_fx_opt_none: 'No (ordinary collection, no income last year…)',
    ce_fx_from_month: 'First month (YYYY-MM, e.g. 2026-06; same amount through next May)',
    ce_step_from: 'Period: from',
    ce_step_to: 'to',
    ce_fy_chip: 'FY ending {y}-{mm} ({from} – {to})',
    ce_period_latest: 'Latest month only',
    ce_period_note:
      'Year-end month: {m} · Books start {start} (opening balances as of the month before) · Bank statements to {last}',
    ce_months_h: 'Month',
    ce_err_period: 'Problem with the period: ',
    ce_p_save: 'Writing outputs for {m}…',
    ce_fs_out_month: 'Written: {path} (workpaper and two summaries)',
    ce_fs_out_range:
      'Written: {a} to {b} under {root}/ ({n} months, each with a workpaper and two summaries)',
    ce_fx_btn: 'Fill in here',
    ce_fx_amount: 'Monthly amount',
    ce_fx_until_may: 'Same amount through next May',
    ce_fx_mode: 'Commute',
    ce_fx_opt_transit: 'Public transport (pass)',
    ce_fx_opt_car: 'Car or bicycle',
    ce_fx_pass_monthly: 'Monthly pass',
    ce_fx_one_way_km: 'One-way distance (km)',
    ce_fx_parking: 'Parking per month (optional)',
    ce_fx_evidence: 'Document (e.g. 2025 notice of determination)',
    ce_fx_wages_koyou: 'Wages paid before the start month (employment insurance)',
    ce_fx_wages_rousai: 'Wages paid before the start month (accident insurance)',
    ce_fx_estimate_paid: 'Estimated premium paid last year',
    ce_fx_withheld_employee: 'Employee share withheld last year',
    ce_fx_installment: 'Pay in three instalments',
    ce_fx_save: 'Save (written into your data on the next run)',
    ce_fx_saved: '✓ Filled in',
    ce_fx_err_required: 'Please fill in: {f}',
    ce_fx_err_num: '{f} must be a number of 0 or more',
    ce_err_fix: 'There is a problem with what you entered: ',
    ce_fs_written: 'Written into {name} (backup of the old file: {path})',
    ce_dl_file: 'Download {name}',
    ce_dl_report: '{name}',
    ce_open_folder: 'Choose working folder',
    ce_cl_h: 'Recent companies',
    ce_cl_item: '{name}: closed through {m}, {n} items need action',
    ce_cl_never: '{name}: not closed yet',
    ce_cl_open: 'Open',
    ce_cl_forget: 'Remove from list',
    ce_reset: 'Start over…',
    ce_reset_q:
      'Move the {n} file(s) in this folder to {path} and start from an empty folder (nothing is deleted; to undo, move them back from there)',
    ce_reset_go: 'Move and start over',
    ce_reset_no: 'Cancel',
    ce_reset_done: 'Moved {n} file(s) to {path}. You can start from an empty folder',
    ce_reset_empty: 'Nothing to move (the folder is already empty)',
    ce_reset_left: 'Not moved: {list} (still open in Excel? Close it and press again)',
    ce_reset_err: 'Could not create {name}: {msg}',
    ce_cl_denied:
      '✗ {name}: permission to read and write the folder was not given. When reopening, press Allow in the permission prompt.',
    ce_cl_gone:
      '✗ {name}: the folder cannot be found (moved, deleted or renamed). Remove it from the list and choose the folder again.',
    ce_cl_d:
      'This list is stored in this browser only (folder contents are not stored). Each time you open one, the browser asks for read and write permission.',
    ce_open_hint:
      'In Chrome or Edge the folder is read and written directly: results and answers are saved back automatically (the browser asks for permission each time). Other browsers: “Choose folder” (read-only, downloads needed).',
    ce_fs_connected: 'Connected: {name} (read/write, {n} files)',
    ce_fs_out: 'Saved: {path}',
    ce_fs_book: 'Answers written into company-data.xlsx (backup of the old file: {path})',
    ce_fs_dec: 'Answers written into decisions.yaml (backup: {path})',
    ce_fs_locked:
      'Could not write to the folder. Is company-data.xlsx open in Excel? Close it and press “Run again with answers” (your answers are kept).',
    ce_fs_err: 'Could not write to the folder: {msg}',
    ce_chip_bank_ok: 'Bank and books agree',
    ce_chip_bank_ng: 'Bank and books differ',
    ce_chip_sus: '{n} held row(s), {v} (figures may change once confirmed)',
    ce_asof: 'As of {d}',
    ce_k_rev: 'Revenue this month',
    ce_k_profit: 'Profit this month',
    ce_k_cash: 'Cash at month end',
    ce_k_items: 'Needs your attention',
    ce_k_ytd: 'Since {f}: {v}',
    ce_k_cash_ok: '= bank balance',
    ce_k_cash_ng: '≠ bank balance',
    ce_k_cash_diff: '≠ bank balance (books are {d})',
    ce_b_info: 'Notices',
    ce_lead_info:
      'These are notices about how the figures are calculated — not errors and not missing information. Read each once; if it does not apply, Answer → done and it will not appear again.',
    ce_ev_date_hint:
      'For “date”, enter the date printed on the document: the receipt date on a receipt, the issue date on an invoice, the debit date on a direct-debit notice.',
    ce_ev_linked_auto: '{d} {t} (matched automatically)',
    ce_k_counts: 'To confirm {ask} · To do {todo} · Possible errors {err} (plus {info} notices)',
    ce_up_h: 'Coming payments',
    ce_up_note_open:
      'Some items are still open; these amounts may change once they are dealt with.',
    ce_up_note: 'Estimated from month-end balances; check against the notices.',
    ce_up_shaho: 'Social insurance for {m}',
    ce_up_gensen: 'Withholding tax',
    ce_up_jumin: 'Resident tax',
    ce_up_tokurei: ' (special schedule)',
    ce_up_none: 'None',
    ce_out_h: 'Outputs',
    ce_bs_h: 'Balance sheet',
    ce_pl_h: 'Income statement',
    ce_pl_month: 'Month',
    ce_pl_ytd: 'Year to date',
    ce_sr_h: 'Find entries (across years)',
    ce_sr_d:
      'Searches the closed years and the period just closed. Enter an account to see it as a ledger with balances.',
    ce_sr_acc: 'Account',
    ce_sr_sub: 'Detail',
    ce_sr_text: 'Text',
    ce_sr_from: 'From',
    ce_sr_to: 'To',
    ce_sr_amount: 'Amount',
    ce_sr_go: 'Search',
    ce_sr_count: 'Showing {n} of {total}.',
    ce_sr_none: 'Nothing found.',
    ce_sr_closed: 'closed (year ending {y})',
    ce_sr_date: 'Date',
    ce_sr_vno: 'Entry',
    ce_sr_narr: 'Narration',
    ce_sr_line: 'Account',
    ce_sr_dr: 'Debit',
    ce_sr_cr: 'Credit',
    ce_sr_bal: 'Balance',
    ce_sr_err: '✗ Run the close first.',
    ce_pl_settle: 'Year-end adj.',
    ce_pl_settle_note:
      'Year-end adjustments are kept out of the year-end month and shown in their own column. Year to date includes them.',
    ce_bs_assets: 'Total assets',
    ce_bs_le: 'Total liabilities and equity',
    ce_pl_net: 'Net income',
    ce_sec_ca: 'Current assets',
    ce_sec_ppe: 'Property and equipment',
    ce_sec_intan: 'Intangible assets',
    ce_sec_inv: 'Investments and other assets',
    ce_sec_cl: 'Current liabilities',
    ce_sec_ncl: 'Non-current liabilities',
    ce_sec_eq: 'Equity',
    ce_sec_sales: 'Revenue',
    ce_sec_cogs: 'Cost of sales',
    ce_sec_sga: 'Selling, general and admin',
    ce_sec_noi: 'Non-operating income',
    ce_sec_noe: 'Non-operating expenses',
    ce_sec_ei: 'Extraordinary gains',
    ce_sec_el: 'Extraordinary losses',
    ce_sec_tax: 'Income taxes',
    ce_sec_other: 'Other',
    ce_items_h: 'Items for you',
    ce_b_ask: 'To confirm',
    ce_b_todo: 'To do',
    ce_b_err: 'Possible errors',
    ce_lead_ask:
      'Already recorded provisionally. Confirm what it is; run again and the figures become final.',
    ce_lead_todo: 'Missing information or things not done yet. Fill them in and run again.',
    ce_lead_err:
      'Figures do not agree — probably an error in the data or the books. Read the analysis and choose what to do.',
    ce_an: 'Analysis',
    ce_sug: 'Suggestion',
    ce_items_none: 'Nothing in this group.',
    ce_check_item: 'Check {id}: ',
    ce_acct_h: 'For the accountant: all checks',
    ce_next_h: 'Next steps',
    ce_next_contact: 'Internal check(s) {ids} failed — please contact us with the workpaper',
    ce_next_checks: 'First deal with the failed check(s) {ids} — see the → line on each',
    ce_next_answer: 'Pending items you can answer on this page: {n}',
    ce_next_both: 'Pending items you can answer or fix in a sheet (see each line): {n}',
    ce_next_sheet: 'Pending items that need a sheet fixed, then a new run: {n}',
    ce_next_sheets: 'Sheets to open: {list} (YAML: {files})',
    ce_next_none: 'Nothing to do. Download the workpaper and review it',
    ce_how_answer: 'Answer here',
    ce_how_sheet: 'Fix a sheet',
    ce_how_both: 'Answer or sheet',
    ce_how_contact: 'Contact us',
    ce_files_intro:
      'First choose one working folder (an empty one is fine). Then add your files through the two inboxes below. The page reads each file, sorts it and saves it into the folder. Results and answers are saved there too.',
    ce_tpl_xlsx: 'Download the blank workbook',
    ce_tpl_yaml: 'Advanced: YAML templates',
    ce_wb_sheets: 'Excel sheets:',
    ce_fd_decisions:
      'After a run, answer with the buttons on this page (they can be written back to the Excel sheet)',
    ce_col_answer: 'Answer',
    ce_ans_intro:
      'Answer each item with its button, then press “Run again with answers”. Answers are kept as judgment records (who, when, why).',
    ce_ans_btn: 'Answer',
    ce_ans_edit: 'Edit',
    ce_ans_saved: '✓ Answered',
    ce_ans_action: 'Action',
    ce_ans_book: 'Book',
    ce_ans_done: 'Done (no entry)',
    ce_ans_account: 'Choose account',
    ce_ans_sub: 'Sub-account (optional)',
    ce_ans_tax: 'Tax category: the account default',
    ce_ans_neg:
      'Enter deducted parts as negative amounts. E.g. a fee payment of 89,790 = 支払報酬 100,000 + 預り金 −10,210 (tax withheld); a receipt of 329,560 = 売掛金 330,000 + 支払手数料 −440 (fee deducted by the payer).',
    ce_ans_split: '+ Split into lines',
    ce_ans_remove: 'Remove',
    ce_ans_diff: 'Remaining {n} yen',
    ce_ans_evidence: 'Evidence',
    ce_ans_reason: 'Reason',
    ce_ans_by: 'Decided by',
    ce_ans_paid_on: 'Paid on (not in the bank statement)',
    ce_ans_paid_on_hint: 'The date it was actually paid, to check the due date',
    ce_ans_paid_on_pick: 'The reason says {d} — use it as the paid date',
    ce_ans_at: 'Date {d}',
    ce_ans_save: 'Save answer',
    ce_ans_cancel: 'Cancel',
    ce_ans_err_by: 'Please enter who decided',
    ce_ans_err_account: 'Please choose an account',
    ce_ans_err_sum: 'The lines do not add up to the amount',
    ce_ans_err_reason: 'Please give a reason',
    ce_rerun: 'Run again with answers ({n})',
    ce_dl_book: 'Download company-data.xlsx with answers',
    ce_dl_decisions: 'Download answers (decisions.yaml)',
    ce_dl_note:
      'Put this file back into your folder next time and you will not need to answer again.',
    ce_adv_yaml: 'Advanced: YAML answer template',
    ce_page_title: 'Closing Engine — Senridoufuu',
    ce_title: 'Month-end Closing Engine (Japan, beta)',
    ce_subtitle: 'Payroll · Social insurance · Withholding · Bank · Consumption tax → Workpaper',
    ce_logout: 'Sign out',
    ce_stance_title: 'People decide. The tool checks.',
    ce_stance_body:
      'Keeping the books is something today’s accounting software and AI already help with. This tool takes the step after that, at month end: it checks payroll, social insurance, taxes and bank balances one by one, and tells you what does not agree, with the reason.',
    ce_stance_a:
      'It does not fill gaps by guessing. When it does not know, it says so and asks you.',
    ce_stance_b:
      'Every figure can be traced to where it came from: the law, the rate table, the row you entered.',
    ce_stance_c:
      'Your financial data never leaves this browser. The closed entries can be taken into the accounting software you use.',
    ce_stance_tail: 'Technology is there for people. That is what Senridoufuu believes.',
    ce_yayoi_note:
      '“弥生会計インポート” is a file of the month’s entries in the format Yayoi Kaikei can import (弥生インポート形式). Load it in Yayoi Kaikei under File → Import. If an account name differs from the one registered in Yayoi, the import screen asks you to match it.',
    ce_yayoi_open_note:
      '“弥生会計期首残高” is a file of the opening balances for the month the books begin, in the format Yayoi Kaikei can import. Open 科目残高入力 in Yayoi Kaikei and load it under File → Import. Retained earnings (繰越利益剰余金) are left out, because Yayoi Kaikei does not let you enter that account directly. After importing, press 貸借調整 and Yayoi Kaikei works it out. If that figure equals the retained earnings in this tool’s opening balances, every balance has carried over.',
    ce_cy_h: 'Close the fiscal year',
    ce_cy_d:
      'Close a fiscal year once its returns are filed. Its figures do not change afterwards; an error found later is corrected with an entry in the current year. Closing writes a file to the “closed” folder of the working folder, and later closes start from the next fiscal year.',
    ce_cy_by: 'Decided by',
    ce_cy_go: 'Close the year ending {m}',
    ce_cy_ok: '✓ Closed the year ending {end} ({n} entries). Later closes start from {next}.',
    ce_cy_err_open: '✗ This year still has open items. Resolve them first: {items}',
    ce_cy_err_checks: '✗ Some months did not pass the checks ({months}). Fix them first.',
    ce_cy_err_not_closed: '✗ Close every month from the start of the year to its end first.',
    ce_cy_err_already: '✗ This year is already closed.',
    ce_cy_err_by: '✗ Enter who decided.',
    ce_cy_err_other: '✗ The year could not be closed ({msg}).',
    ce_cy_closed: 'Closed years: {list}. Closes start from the following year.',
    ce_cy_item: 'year ending {end} ({by}, {at})',
    ce_lr_h: 'Bank rule candidates found in the Yayoi entries',
    ce_lr_h_dict: 'Bank rule candidates from common descriptions',
    ce_lr_sum_dict:
      '{n} bank line(s) have descriptions that mean the same for any company (transfer fees, deposit interest, rent, utilities, phone)',
    ce_lr_d_dict:
      'These come from a built-in dictionary, not from this company’s past bookkeeping. Only the ticked ones are written into the company data. Tax office, city hall, legal affairs bureau and transfers to people can mean several things, so they are not suggested; you will be asked line by line.',
    ce_lr_sum:
      '{name}: {v} entries ({from} to {to}), of which {p} were paired with bank rows by date and amount. A description becomes a candidate when two or more rows with it were all booked to the same account.',
    ce_lr_d:
      'Candidates are only candidates: only the ticked ones go into the company workbook. Salary, social insurance and tax payments are not offered, because the close matches them from its own calculations.',
    ce_lr_inn: 'in',
    ce_lr_out: 'out',
    ce_lr_n: '{n} rows',
    ce_lr_none:
      'No new candidates (a rule for the description already exists, or no description has two matching rows).',
    ce_lr_split_h: 'Descriptions not offered because past entries used different accounts',
    ce_lr_unknown_h:
      'Accounts not in the chart (register them on “Extra accounts” to add their candidates too)',
    ce_lr_unknown_mark: 'not in the chart',
    ce_lr_by: 'Decided by',
    ce_lr_go: 'Add the selected rules to the company workbook',
    ce_lr_ok: '✓ Added {n} bank rules to the company workbook (previous file: {path})',
    ce_lr_err_by: '✗ Enter who decided.',
    ce_lr_err_empty: '✗ No addable candidate is selected.',
    ce_lr_err_no_bank:
      '✗ {name}: these are Yayoi entries, but the folder has no bank statements for the same period. Add the statements first, then add this file again.',
    ce_lr_err_no_book:
      '✗ {name}: these are Yayoi entries, but there is no company workbook yet. Add the company workbook first.',
    ce_lr_err_file: '✗ {name}: line {line} is not in the Yayoi import format.',
    ce_pv_title: 'The entry this answer will make',
    ce_pv_debit: 'Debit',
    ce_pv_credit: 'Credit',
    ce_pv_wait: 'The entry appears here once the account and amount are filled in.',
    ce_privacy:
      'Your financial data is processed only inside this browser and is never sent to a server. The page downloads only the runtime and the engine itself.',
    ce_optional: 'Optional',
    ce_z_tab_t: 'Tables (Excel, CSV)',
    ce_z_tab_d:
      'Company workbook, bank statements and Yayoi Kaikei opening balances and entries. Drag them here, or press “Choose files”.',
    ce_z_ev_t: 'Evidence (photos, PDFs)',
    ce_z_ev_d:
      'Receipts, invoices, tax slips. Date, amount and party are read on this computer; images are never uploaded.',
    ce_z_pick: 'Choose files',
    ce_z_need_folder: 'Choose the working folder first; the two inboxes need somewhere to save.',
    ce_z_looking: 'Reading: {name}',
    ce_z_wb_ok: '✓ {name} → company workbook (company-data.xlsx)',
    ce_z_wb_replaced: '✓ {name} → company workbook replaced (previous file: {path})',
    ce_z_bank_ok: '✓ {name} → bank statements (“bank” folder)',
    ce_z_bank_unchecked:
      '✓ {name} → bank statements (“bank” folder). No bank account is registered in the company workbook yet, so the column names are not checked (they will be at the next check once one is registered)',
    ce_ev_helper_denied:
      'The browser is blocking this page from reaching the local reading helper. Click the icon left of the address bar → site permissions, set “Local network access” (apps on this device) to Allow, and reload. This time only the first page is read inside the browser',
    ce_ev_helper_ask:
      'The browser is asking whether to allow access to other apps on this device. Click “Allow” (this connects to the local reading helper; waiting up to 60 s)',
    ce_bk_cols:
      '{name}: could not tell the date, description, out, in and balance columns from the header. Enter the column names in the “bank accounts” sheet of the company workbook',
    ce_bk_chain:
      '{name}: read with the columns guessed from the header, the balance breaks in {n} place(s); the guess may be wrong, so nothing was registered. Enter the column names in the “bank accounts” sheet of the company workbook',
    ce_bk_choose:
      '{name}: the opening balances have several deposit lines ({list}), so it is unclear which account this statement belongs to. Register it in the “bank accounts” sheet of the company workbook',
    ce_bk_open_ng:
      '{name}: the balance before the first transaction is {before} yen but the opening balance is {opening} yen. Check that the statement starts at the opening date, or check the opening balance',
    ce_bk_open_ok:
      '{name}: the balance before the first transaction ({before} yen) matches the opening balance',
    ce_bk_ok:
      '✓ {name}: registered the bank account “{acct}” in the company workbook (columns date・description・out・in・balance = {cols}; {n} rows {from}–{to}, balances chain correctly). The previous workbook was backed up to {path}',
    ce_z_bank_nobook:
      '✓ {name} → bank statements (“bank” folder). No company workbook yet, so the column names are unchecked',
    ce_z_bank_other:
      '✗ {name}: this looks like a bank statement, but its headings ({found}) differ from the column names registered on the “Bank accounts” sheet of the company workbook ({want}). Change the registered names to match the file, then add it again',
    ce_z_unknown:
      '✗ {name}: not a company workbook, a bank statement or Yayoi Kaikei opening-balance data, so it was not saved',
    ce_z_op_ok:
      '✓ {name} → {n} rows written to the “Opening balances” sheet of the company workbook (previous file: {path})',
    ce_z_op_retained:
      '{name}: retained earnings (繰越利益剰余金) of {amount} yen were filled in as the difference between debits and credits, the same calculation as 貸借調整 in Yayoi Kaikei. Check the figure against last year’s balance sheet',
    ce_z_op_names:
      '{name}: some account names are not in the chart of accounts ({list}). Rename them on the “Opening balances” sheet or add them on the “Extra accounts” sheet',
    ce_z_op_no_book:
      '✗ {name}: this is Yayoi Kaikei opening-balance data, but there is no company workbook yet. Add the company workbook first (it holds the month the books begin and the fiscal year end)',
    ce_z_op_exists:
      '✗ {name}: there are already {n} opening-balance rows, and they are not overwritten. To import again, clear the “Opening balances” sheet of the company workbook and add the file once more',
    ce_z_op_start:
      '✗ {name}: the first day in this file ({day}) is not the first day of the month the books begin in the company workbook ({start}). Correct one of them',
    ce_z_op_file:
      '✗ {name}: line {line} is not in the Yayoi Kaikei opening-balance format (期首日, 勘定科目名, 貸借区分, 補助科目名, 部門, 前期繰越残高, in that order)',
    ce_z_op_book:
      '✗ {name}: the company workbook has something to correct, so nothing was imported ({msg})',
    ce_z_op_yaml: '✗ {name}: this company folder is kept in YAML, so the file cannot be imported',
    ce_z_err: '✗ {name}: could not be read ({msg})',
    ce_z_skip:
      '✗ {name}: this file type is not supported (tables: Excel or CSV; evidence: images or PDF)',
    ce_ev_generic:
      'Read from the “{key}” field of the document. Documents of this kind cannot be cross-checked, so compare with the original before confirming',
    ce_ev_generic_nokey:
      'Read from the wording of the document. Documents of this kind cannot be cross-checked, so compare with the original before confirming',
    ce_ev_no_template:
      'This kind of document cannot be read automatically yet. Click the file name to open the original and enter the date, amount and party from it',
    ce_ev_fx_ask:
      'This document is in a foreign currency ({cur} {amt}). Enter the amount converted to yen. Note the rate you used so it can be checked later.',
    ce_ev_fx_rounded:
      'This document is in a foreign currency ({cur} {amt}). The conversion written on it, {amt} × {rate} = {yen}, was rounded to the nearest yen and entered as the amount. Please check it.',
    ce_ev_fx_used:
      'This document is in a foreign currency ({cur} {amt}). The conversion written on it, {amt} × {rate} = {yen}, was entered as the amount. Please check it.',
    ce_ev_fx_unread:
      'This looks like a foreign-currency ({cur}) document, but the amount could not be read reliably. Check the document and enter the amount converted to yen.',
    ce_ev_open: 'Open the original: {name}',
    ce_ev_open_err: 'Could not open the original ({msg})',
    ce_fix_where:
      '“Fix the sheet” means editing “company-data.xlsx” inside the working folder (the “{name}” folder you chose), not the copy where you originally kept it. Edit it in Excel, save, close Excel, then press “Run”. To add bank statements, use the “Tables” inbox above.',
    ce_ev_by_label:
      'Decided by (remembered on this computer; recorded when confirming documents, answering questions, adding bank rules and closing a year)',
    ce_rerun_note:
      'While a working folder is connected, your answers are written into “company-data.xlsx” in that folder (the previous file is first copied to “closing-results/backup”).',
    ce_period_why:
      'Books are closed month by month from the start, so by default the run covers the fiscal year’s first month through the “to” month. You can switch months in the results. For one month only, press “Latest month only”.',
    ce_ev_box: 'Evidence list and confirmation',
    ce_ev_count: '{n} on file, {d} to confirm',
    ce_ev_count_none: 'None yet',
    ce_ev_col_kind: 'Type',
    ce_ev_basis_photo: 'Image file → guessed paper',
    ce_ev_basis_scan: 'Scanned PDF without text → guessed paper',
    ce_ev_basis_text: 'PDF with text → guessed electronic',
    ce_ev_basis_vector: 'Software-made PDF → guessed electronic',
    ce_how_h: 'How it works (click to enlarge)',
    ce_how_1: 'Month-end, and the paperwork is everywhere',
    ce_how_2: 'Tables in one place: company workbook and bank statements',
    ce_how_3: 'Photos and PDFs in one place: receipts and invoices',
    ce_how_4: 'Choose the folder and the closing results appear',
    ce_how_prev: 'Previous',
    ce_how_next: 'Next',
    ce_close: 'Close',
    ce_step_files: 'Choose the working folder and add your files',
    ce_col_file: 'File',
    ce_col_need: 'When needed',
    ce_col_state: 'Status',
    ce_f_company: 'Company profile and policies',
    ce_fd_company:
      'Prefecture, year-end, start month, 9 payroll policies, consumption tax status, bank accounts. Each judgment records who and when',
    ce_f_employees: 'Employee roster',
    ce_fd_employees:
      'Birth date, hire date, standard monthly remuneration, dependents, resident tax, fixed pay',
    ce_f_opening: 'Opening balances',
    ce_fd_opening: 'Trial balance at the end of the month before the start month',
    ce_f_bank: 'Bank statements',
    ce_fd_bank:
      'Downloads from online banking as they are (CSV or Excel), up to the end of the month you close',
    ce_f_monthly: 'Monthly payroll changes and invoices',
    ce_fd_monthly:
      'payroll.yaml (overtime, hourly pay…), sales.yaml (invoices). Without them the roster pay is used',
    ce_f_bank_rules: 'Bank rules',
    ce_fd_bank_rules:
      'Write once for recurring rows (rent, fees…) and they are booked automatically',
    ce_f_fixed_assets: 'Fixed asset register',
    ce_fd_fixed_assets: 'Monthly depreciation is computed from it',
    ce_f_decisions: 'Answers to open items',
    ce_f_adjustments: 'Adjusting entries',
    ce_fd_adjustments:
      'Non-bank transactions, allocations, year-end adjustments (with who and when)',
    ce_f_labor_insurance: 'Labour insurance annual renewal',
    ce_fd_labor_insurance:
      'June–July: wages before the start month, last year’s estimated premium, etc.',
    ce_f_corporate_tax: 'Corporate tax worksheet',
    ce_fd_corporate_tax: 'Year-end month: tax adjustments, loss carryforward, interim payments',
    ce_need_required: 'Required',
    ce_need_monthly: 'Monthly',
    ce_need_optional: 'Optional',
    ce_need_season: 'Jun–Jul',
    ce_need_year_end: 'Year-end',
    ce_s_wait: 'Not checked',
    ce_s_ok: '✓ Found',
    ce_s_missing: '✗ Missing',
    ce_s_gaps: '⚠ {n} setting(s) to fill in (list below)',
    ce_s_error: '✗ Format error',
    ce_s_absent: '— Not provided',
    ce_s_warn: '⚠ Needed this month',
    ce_pick_folder: 'Choose working folder',
    ce_upload_none: 'No folder selected',
    ce_upload_count: '{n} files selected',
    ce_upload_hint:
      'If you use office defaults (office), put that file inside the folder too. Files are read only inside this browser.',
    ce_pre_running: 'Checking the files…',
    ce_pre_ok_warn:
      'You can run the close, but some items are marked ⚠. Check the inboxes above and “Check details” first.',
    ce_pre_ok: 'All set. You can run the close.',
    ce_pre_block:
      'Some files are missing or malformed. Add them following the list above: drop files into the boxes below and the check runs again by itself (if you edited files in the folder directly, choose the folder again).',
    ce_gaps_recheck: 'Done — check again',
    ce_gaps_lead_qa:
      '{n} setting(s) are still undecided. Answer them here and press “Save answers” to write them into “{book}” (the old file is backed up; who decided and the date are recorded). You can save a few at a time. If you filled them in Excel instead, press “Done — check again”',
    ce_gaps_save: 'Save answers',
    ce_gaps_pick: '— choose —',
    ce_gaps_none: 'No answers yet',
    ce_ev_staff_added:
      'Added {names} from the timesheet to the employee table (previous company data backed up to {path}). Please answer the questions above (role, date of birth and so on).',
    ce_gaps_saved:
      'Wrote {n} answer(s) into the company data (backup of the old file: {path}). Checking again…',
    ce_gaps_bad: 'Some answers could not be written (the company data was not changed): {list}',
    ce_gaps_choices: '(choose: {list})',
    ce_gaps_sheet: 'Sheet “{sheet}”',
    ce_gaps_lead:
      'Open “{book}” in the folder with Excel and fill in the {n} items below. On the policy sheet, also fill in “decided by” and “date” to the right of each choice. Save, then click “Done — check again”.',
    ce_pre_gaps: 'Some settings in the company workbook are not decided yet (see the list below).',
    ce_pre_engine_err: 'The engine found a problem:',
    ce_step_run: 'Close the month',
    ce_step_month: 'Month',
    ce_step_lang: 'Workpaper language',
    ce_lang_zh: 'Chinese',
    ce_lang_ja: 'Japanese',
    ce_run: 'Run close',
    ce_p_runtime: 'Downloading the runtime (first time only, 10–20 s)',
    ce_p_packages: 'Loading components',
    ce_p_engine: 'Preparing the engine',
    ce_p_ready: 'Starting',
    ce_p_month: 'Closing {label} ({i}/{n} months)',
    ce_p_workpaper: 'Writing the workpaper',
    ce_p_elapsed: '{n} s elapsed',
    ce_p_note:
      'The calculation runs in the background, so the page stays responsive. Please keep this page open.',
    ce_disclaimer:
      'This tool assumes an accountant makes the judgments. The corporate tax sheet is an estimate, not a tax return.',
    ce_status_done: 'Done',
    ce_err_auth:
      'The engine could not be loaded. Sign in again and retry (the engine is available to signed-in members only).',
    ce_err_bundle: 'The engine files are damaged or mid-update. Please reload the page.',
    ce_err_load:
      'Could not load the runtime. Check your network or browser extensions such as ad blockers, then reload.',
    ce_err_no_company:
      'This folder has no company workbook yet. Add “company-data.xlsx” through the “Tables” inbox below (if you already have a folder with your files, choose that folder itself: not its parent, and not the “bank” folder).',
    ce_err_no_month: 'Please choose a month.',
    ce_err_company: 'Problem in the company data:',
    ce_err_close: 'The close stopped:',
    ce_err_runtime: 'Unexpected error:',
    ce_summary: '{pass}/{n} passed · {fail} failed · {skip} not checked · {na} not applicable',
    ce_download: 'Download workpaper (xlsx)',
    ce_checks: 'Checks',
    ce_col_id: 'ID',
    ce_col_check: 'Check',
    ce_col_status: 'Result',
    ce_col_n: 'Items',
    ce_st_pass: 'Pass',
    ce_st_fail: 'Fail',
    ce_st_skip: 'Not checked',
    ce_na: 'Not applicable',
    ce_pending: 'To confirm ({n})',
    ce_col_qid: 'No.',
    ce_col_cat: 'Category',
    ce_col_item: 'Item',
    ce_col_date: 'Date',
    ce_col_amount: 'Amount',
    ce_answers: 'Answer template (append to decisions.yaml)',
    ce_answers_none: 'No unmatched bank rows.',
    ce_copy: 'Copy',
    ce_copied: 'Copied',
    ce_sample_line: 'See an example result first:',
    ce_sample_tokyo: 'Fictional Tokyo company',
    ce_sample_osaka: 'Fictional Osaka company',
    ce_sample_banner: 'This is the result for a fictional sample company.',
    closing_title: 'Month-end Closing Engine (Japan)',
    closing_one:
      'Closes payroll, social insurance, withholding, bank and consumption tax, and outputs a checked workpaper. Data never leaves your browser.',
    closing_cta: 'Open the engine',

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
    an_sections_info: '{n} sections · {sel} selected · about {chars} characters',
    an_chars: '{chars} characters',
    an_chars_sel: '{sel} / {total} characters',
    an_file_reading: 'Reading…',
    an_file_error: 'Error',
    an_file_scanned: '0 characters — this may be a scanned PDF',
    an_remove_title: 'Remove',
    an_drop_more: 'Click to add more',
    an_skip_limit: 'Up to {max} files are allowed. Not added: {list}',
    an_skip_type: 'Unsupported format: {list}',
    an_skip_dup: 'A file with the same name has already been added: {list}',
    an_err_local: 'This does not work in the local environment. Please try it after deployment.',
    an_err_empty: 'The analysis returned no result.',
    an_err_server: 'Server error (HTTP {status})',
    an_err_server_hint: 'Try fewer files, or split your question into smaller ones.',
    an_err_fallback: '(Image analysis failed, so text analysis was retried — that failed too.)',
    an_round: '**Round {round}/{max}** · {note}',
    an_reading_pages: 'Reading: {pages}',
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
            <a href="about/company.html" class="nav__dropdown-link" data-i18n="nav_company"></a>
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
      <a href="/contact.html" class="nav__cta" data-i18n="nav_consult"></a>
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
    <a href="about/company.html" class="nav__mobile-child" data-i18n="nav_company"></a>
    <a href="about/milestones.html" class="nav__mobile-child" data-i18n="nav_milestones"></a>
  </div>
  <div class="nav__mobile-section">
    <div class="nav__mobile-parent" data-i18n="nav_solutions"></div>
    <a href="solutions/" class="nav__mobile-child" data-i18n="nav_products"></a>
    <a href="solutions/demo.html" class="nav__mobile-child" data-i18n="nav_demo"></a>
    <a href="solutions/blog/" class="nav__mobile-child" data-i18n="nav_blog"></a>
  </div>
  <a href="/contact.html" class="nav__mobile-cta" data-i18n="nav_consult"></a>
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
          <a href="about/company.html" class="footer__link" data-i18n="nav_company"></a>
          <a href="about/milestones.html" class="footer__link" data-i18n="nav_milestones"></a>
          <a href="solutions/" class="footer__link" data-i18n="nav_products"></a>
          <a href="solutions/demo.html" class="footer__link" data-i18n="nav_demo"></a>
          <a href="solutions/blog/" class="footer__link" data-i18n="nav_blog"></a>
        </div>
      </div>
      <div>
        <div class="footer__col-heading" data-i18n="footer_contact_heading"></div>
        <address class="footer__address">
          <a href="mailto:yuki.minami@senridf.com">yuki.minami@senridf.com</a><br>
          <a href="contact.html" data-i18n="nav_consult"></a><br><br>
          <span data-i18n="addr_street"></span><br>
          <span data-i18n="addr_city"></span>
        </address>
      </div>
    </div>
    <div class="footer__bottom">
      <span class="footer__copy" data-i18n="footer_copy"></span>
      <a href="privacy/" class="footer__link" data-i18n="nav_privacy"></a>
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
  // 画像の代替テキストも読み上げ・検索に出る文案（受発注の変換例で初使用）。
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    const key = el.dataset.i18nAlt;
    if (t[key] !== undefined) el.setAttribute('alt', t[key]);
  });
  // Active state on language buttons
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  // html lang attr
  const langMap = { ja: 'ja', zh: 'zh-CN', en: 'en' };
  document.documentElement.lang = langMap[lang] || 'ja';
  // Page title
  // 标题里没有公司名的（如「受発注の自動化」「プライバシーポリシー」），后面补上「| 公司名」。
  // 以前直接用键值，首页被覆盖成只剩「千里同風株式会社」，其他页又缺公司名——搜索结果和
  // 浏览器标签上都看不出是谁的网站（2026-10-06 基本功体检发现）。
  const titleKey = document.body.dataset.pageTitle;
  if (titleKey && t[titleKey]) {
    const tt = t[titleKey];
    document.title = /千里同風|Senridoufuu/.test(tt) ? tt : `${tt} | ${t.hero_corp}`;
  }
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

/** 当前界面语言。给需要把语言传给后端的页面用（人生故事的访谈提示词要跟随它）。 */
window.sdfLang = function () {
  return currentLang;
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

/* === TIMELINE（大事记，2026-10-18）===
   content.json 的 timeline：[{ id: 'ms5', date: '2026.10' }, ...]，数组顺序＝显示顺序，由后台增删移。
   有就按它重绘 .timeline；没有就保留页面里写死的条目（静态兜底，也是首次编辑时的起点）。
   文字仍是 msN_event / msN_desc 三语键；新加的条目若某语言还没翻译，先显示中文、再退到日文，
   不留空白。后台预览改动后也调这个（window.sdfRenderTimeline）。 */
function renderTimeline(list, { visible = false } = {}) {
  const box = document.querySelector('.timeline');
  if (!box || !Array.isArray(list)) return;
  const t = T[currentLang] || T.ja;
  const pick = (k) => (t[k] !== undefined ? t[k] : T.zh[k] !== undefined ? T.zh[k] : T.ja[k] || '');
  box.querySelectorAll('.timeline__item').forEach((el) => el.remove());
  list.forEach(({ id, date }, i) => {
    const item = document.createElement('div');
    item.className = 'timeline__item';
    item.dataset.msId = id;
    item.setAttribute('data-animate', '');
    if (i > 0) item.dataset.animateDelay = String(Math.min(i, 5));
    if (visible) item.classList.add('is-visible');
    const year = document.createElement('div');
    year.className = 'timeline__year';
    year.textContent = date;
    const body = document.createElement('div');
    const ev = document.createElement('h3');
    ev.className = 'timeline__event';
    ev.dataset.i18n = id + '_event';
    ev.textContent = pick(id + '_event');
    const desc = document.createElement('p');
    desc.className = 'timeline__desc';
    desc.dataset.i18n = id + '_desc';
    desc.textContent = pick(id + '_desc');
    body.append(ev, desc);
    item.append(year, body);
    box.appendChild(item);
  });
}
window.sdfRenderTimeline = (list) => renderTimeline(list, { visible: true });

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
      try {
        if (Array.isArray(ov.timeline)) renderTimeline(ov.timeline);
      } catch (err) {
        console.error('[main] renderTimeline failed:', err);
      }
    })
    .catch((err) => console.warn('[main] content.json 加载失败，页面用的是内置兜底文案：', err))
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
