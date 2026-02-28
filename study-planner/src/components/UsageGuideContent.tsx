/** アプリの使用方法コンテンツ（詳細版） */

export function UsageGuideContent() {
  return (
    <div className="mx-auto max-w-xl space-y-6 text-sm text-slate-700">
      <h2 className="text-lg font-bold text-slate-800">アプリの使用方法</h2>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">画面の基本構成</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li><strong>画面上部（ヘッダー）</strong>：「○○さんの学習計画」と表示。右側の「ロック」ボタンを押すとアプリがロックされ、ロック画面に戻ります。「アプリの使用方法」ボタンを押すと、いつでもこの説明画面を開けます。</li>
          <li><strong>画面下部（タブナビ）</strong>：ホーム・カレンダー・進捗・タイマー・科目・設定の6つのタブがあります。タップするとその画面に切り替わります。</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">ホームタブ</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>「試験まであと○日」「基礎期／実践期／直前期」のバッジが表示されます。</li>
          <li><strong>今日の学習計画</strong>に、各科目ブロック（英語・数学など）とタスク一覧が出ます。</li>
          <li>各タスクの右側にある青い<strong>「開始」</strong>ボタンを押すと、タイマータブへ移動し、ポモドーロタイマーで学習を開始できます。</li>
          <li><strong>「完了」</strong>ボタンを押すと、そのタスクが完了として記録され、チェックが入ります。</li>
          <li><strong>「ブロック完了」</strong>ボタンを押すと、そのブロック内の未完了タスクが一括で完了になります。</li>
          <li>全てのタスクを完了すると「今日のタスク完了！」と表示されます。</li>
          <li>「今日の振り返り（保護者への報告用）」欄で自由記述でき、学習レポートに含まれます。</li>
          <li>下部の「学習統計」で過去7日間の学習時間や科目別累計を確認できます。</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">カレンダータブ</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>月別カレンダーで予定を確認できます。左右スワイプで月を切り替えられます。</li>
          <li>日付をタップすると、その日のイベント（部活試合・学校行事・模試など）が表示されます。</li>
          <li><strong>「イベントを追加」</strong>ボタンを押すと、日付・タイトル・種類・期間を入力してイベントを登録できます。登録したイベントに応じて学習計画が自動調整されます。</li>
          <li><strong>「仮本番を設定」</strong>から、1日目・2日目の日程を設定できます。設定すると学習計画に反映されます。</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">進捗タブ</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li><strong>実際の進捗状況</strong>：完了したタスクの累計学習時間を月別ヒートマップで確認できます。色が濃いほど学習時間が多いことを示します。</li>
          <li><strong>予定の学習内容</strong>：科目×月ごとの予定学習項目が表形式で表示されます。</li>
          <li>表のセルを<strong>タップ</strong>すると編集モーダルが開きます。「・」や「,」で区切って学習項目を入力・修正でき、<strong>「保存」</strong>で反映されます。<strong>「算出値に戻す」</strong>で自動算出の値に戻せます。</li>
          <li>空のセルには「·」が表示され、タップで学習項目を追加できます。</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">タイマータブ</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>ホームのタスクの<strong>「開始」</strong>を押すと、タイマータブにそのタスクが渡され、ポモドーロタイマーがセットされます。</li>
          <li>タイマー中央の<strong>再生ボタン</strong>を押すとカウントダウンが始まり、<strong>一時停止ボタン</strong>で停止できます。</li>
          <li>1ポモドーロ（通常25分）が終わると休憩タイマーに切り替わります。</li>
          <li>学習が終わったら<strong>「タスク完了」</strong>を押すと、記録され進捗に反映されます。</li>
          <li>設定タブでポモドーロの作業時間・休憩時間を変更できます。</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">科目タブ</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>上部の<strong>得点戦略シミュレーター</strong>で、現在得点・目標得点・科目ごとの伸びしろを確認し、目標までの計画を立てられます。</li>
          <li>科目カードを<strong>タップ</strong>すると、その科目の詳細画面（学習項目・得点推移など）に移動します。</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">設定タブ</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li><strong>「今すぐロック」</strong>を押すとアプリがロックされ、パスワード入力画面に戻ります。</li>
          <li>試験日・勉強開始日の変更、1日のスケジュール（起床・就寝・学校時間・部活など）、学習ブロックの時間配分、ポモドーロの時間設定を変更できます。</li>
          <li><strong>学習レポート（保護者用）</strong>で、期間を選んでレポートをコピーし、保護者と共有できます。</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">ロック画面</h3>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>「○○の試験までの道」と今日の心構えが表示されます。</li>
          <li><strong>「アプリの使用方法」</strong>ボタンで、ロック解除前でも使い方の説明を確認できます。</li>
          <li>パスワードを入力して<strong>「解除」</strong>を押すとアプリを利用できます。初回利用時は「パスワードを作成」から4文字以上のパスワードを設定してください。</li>
        </ul>
      </section>
    </div>
  );
}
