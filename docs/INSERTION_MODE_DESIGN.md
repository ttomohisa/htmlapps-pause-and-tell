# Pause & Tell — explanation insertion mode

> 詳細な実現性調査・採用方式・受け入れ条件は後半の「2026-10-16 実現性調査・設計判断」を参照。

> Original design proposal (2026-10-16). An isolated v0.11.0 implementation now passes short-file Chromium synthetic tests for multiple timestamped inserts with source sound. Not integrated into the v0.9.3 user-facing app; not proof of physical mobile performance. See [PoC validation](INSERTION_POC_VALIDATION.md).

## User goal

Given a 30-second original clip, seek to 10.0 seconds and record a 15-second spoken explanation with still-frame pen/arrow markup. The exported 45-second video should contain every original frame in order, with a 15-second annotated still-frame and voice inserted at 10.0 seconds. The source file must never be modified. For source video containing sound, preserve the original soundtrack before/after the insertion and stop it during the insert.

## Intended workflow

1. Choose an original video; freely seek to a timestamp.
2. Start a standalone explanation clip at that timestamp; keep the source frame still while recording only narration and annotations.
3. Finish the explanation clip and store `{ sourceTime, explanationDuration, voice, frames }` (with a stable clip ID).
4. Add multiple clips at arbitrary positions. Allow delete, redo, and adjustment before final export.
5. Export one new video composed as source [0, t1] + explanation at t1 + source [t1, t2] + ... + the source tail, keeping all original footage and preserving source-audio timing.

## Difference from v0.9.3

Current implementation records Canvas video + mic audio continuously using MediaRecorder. Seeking the original after recording starts simply changes the displayed source position in the live output; skipped frames and original audio cannot be restored from that recording. It would be misleading to present this as an insertion workflow.

## Implementation options

- **Browser APIs, real-time final rendering:** Keep the original file as a Blob URL, capture each explanation independently, then render the complete composition from start to finish through Canvas + Web Audio + MediaRecorder. This can avoid large new WASM dependencies but requires the entire composition duration to elapse again during export; re-encoding quality and background interruptions remain real concerns.
- **Local FFmpeg/WASM composition:** Retain time-stamped explanation segments; mux or re-encode source intervals and inserted segments entirely in the browser. Works in principle without server upload, but codec/container mismatches, keyframe cuts, original-audio mixing, higher memory/CPU cost, Worker/WASM/CSP and single-HTML size must all be tested. Do not assume arbitrary MP4 source clips can be concatenated without re-encoding.
- **WebCodecs + muxing:** Could give explicit control over time stamps with compatible codecs but does not guarantee cross-browser demuxing/muxing or iOS native playback. More engineering and compatibility work.

## Recommended proof and acceptance

1. One insertion into a short *silent* landscape clip: compare original frames before and after the insertion, and verify output duration is `sourceDuration + explanationDuration`.
2. Verify a short original soundtrack survives before/after insertion, narration is present in insert, and there is no duplicated original audio.
3. Multiple inserts, deletions, editing order, portrait/rotation and saved-file playback in an independent player.
4. Verify memory recovery, interrupted export and resource cleanup, then run Android Chrome and iPhone Safari device tests before claiming long or mobile support.

Treat a working one-insertion output as the gate before replacing the current one-take recorder. Keep the existing Draft PR unmerged until the user confirms the desired primary workflow.

---

## 2026-10-16 実現性調査・設計判断（前半は当初案、以下が採用検討の基準）

**状態：設計レビューのみ。実装・実ファイル検証は未実施。Draft PR #1 の v0.9.3 には差し込みエンジンを追加していない。**

### 1. 採用したい製品動作

- 元動画を1本選び、その好きな時刻に移動する。元動画全体を録画し直す必要はない。
- 「ここに説明を追加」で選択フレームを固定し、説明中のマイク音声と描画の時間変化だけを独立記録する。
- 説明は複数追加、選択、削除、再録音できる。元動画は常にオリジナルのまま保持する。
- 出力時には **元動画の全区間を順番どおり残し**、指定時刻の間に説明区間（静止フレーム・描画の変化・ナレーション）を挿入する。動画内でのタイムジャンプではない。
- 元動画に音がある場合、元の区間では映像と音を保持し、説明中は元動画音声を進めず、ナレーションを流す。音がない元動画にも対応する。
- 説明区間の保存／削除のやり直しを実装する。収録済み動画を書き換えたと誤認させない。
- いまの「録画を終了」の確認仕様を説明区間の終了にも整合させる。確認中に音声を録り続けるかどうかはUIと検証で確定させ、無言の時間が混入しない設計を優先する。

**例：** 30秒の元動画の10秒地点に8秒、22秒地点に12秒の説明を追加すると、完成動画は原則50秒（30＋8＋12）になる。元動画の11〜21秒や23〜30秒も消えない。タイムスタンプの丸め・エンコーダーの遅延は実ファイルで検証する。

### 2. 三つの時間を明示的に分ける

- **元動画時間**：指定位置の映像フレームのプレゼンテーション時刻。単なるスライダー表示値ではなく、表示されたフレームの実時刻を優先する。
- **説明時間**：個々の録音を開始してからの相対時刻。マイク音声の実際の長さと、描画の開始・変化・終了・消去イベントを同期する。
- **完成動画時間**：元動画時間に、その時点までに挿入された説明の長さを足した時刻。説明を追加・削除したら計算し直す。

一つの説明区間は概念的に「固定ID、元動画上の挿入位置、実フレーム時刻、録音Blobと実録音長、正規化描画イベントと各時刻、確認状態」を持つ。**独立保存するのは原則、マイク音声と描画イベント**であり、最初から30fpsの静止映像を別録画する必要はない。挿入位置が同一の複数区間は作成順を保持する。

描画中のCtrl+Z／Ctrl+Yは、その操作時点の表示状態の変化としてイベントを記録する。後から説明を再録音した場合はその区間全体を置換する。単純な「最終的な線の配列」だけでは、声に合わせて線が描かれる様子を再現できない。

マイクの収録開始・終了と描画イベントの時刻差、エンコーダー遅延は検証対象。requestVideoFrameCallback の mediaTime が使える環境では実際に表示したフレームの時刻取得に活用するが、正確な切り出し点は別途出力データで照合する。

### 3. 候補の比較

| 方式 | 編集中に全編再生 | 書き出し時の動画エンコード | 強み | 主な課題 |
| --- | --- | --- | --- | --- |
| **A. Mediabunny＋WebCodecs** | 不要 | 安全な初期実装は元動画の再エンコードがあり得る。条件が合えば一部パケットコピーを検討 | JS中心、コンテナ読書き、細かな時間制御、出力ストリーミング | ブラウザごとの対応コーデック差。任意位置での無劣化挿入は未検証 |
| **B. 専用FFmpeg WASM** | 不要 | コーデック・切断点によりパケットコピー／一部または全編再エンコード | 既存のBrowser Kitty FFmpegビルダー資産を利用可能 | スマホのCPU・メモリ、ST/MT、WASMサイズ、GPL系エンコーダーのライセンス |
| **C. 元動画をCanvasで全編再生して録り直す** | 編集中は不要 | 出力時に全編の再生・再録画が必要 | 現行の録画エンジンを利用しやすい | 完成時間分の書き出し、フォアグラウンド依存、再圧縮、同期不良のリスク |

**推奨：まずAで最小PoC。** Mediabunnyにはファイル読込、パケット入出力、WebCodecsを使ったエンコード、出力先への分割書き込みがある。ただし「簡単なtrim＋concatだけで任意フレームに完全無劣化挿入できる」とは判断しない。BはAが端末・形式条件を満たせない場合の比較候補とし、Cはユーザーが求める設計と異なるため主方式に採用しない。

### 4. 書き出しを二段階で検討する

**優先1 — 正しく差し込める書き出し（必須）**

元動画の再生区間と説明区間を1本の時間軸に並べ、ブラウザ内で完成ファイルを生成する。デコード・エンコードは編集作業中ではなく書き出し時に行う。WebCodecs のエンコーダーが利用できる環境では、元動画を必要に応じて再エンコードしてよい。この段階では「元映像の一部が抜けず、元音声とナレーションが正しくつながり、ファイルを保存・再生できること」を最優先する。

**優先2 — 元映像を再エンコードしない高速経路（任意・後回し）**

圧縮済みの元映像・元音声をパケット単位で保持し、元動画の時刻と説明区間を合わせて再配置する。Mediabunnyの EncodedPacketSink / EncodedVideoPacketSource や専用FFmpegのstream copyが候補になる。ただし、H.264/HEVC/VPx等の前後参照フレーム、キーフレーム境界、Bフレームの表示・デコード順、同一映像トラックでのコーデック設定変更、音声のサンプル粒度、タイムスタンプを正しく扱う必要がある。**これらを満たさない場合は安全な再エンコードへフォールバックし、無劣化を表示しない。**

FFmpeg公式のconcat demuxerも入力セグメントが同一ストリーム構成・コーデック・time base等を要する。WebCodecsだけではMP4/WebMのdemux/muxは提供されないため、コンテナ処理が別途必要。Mediabunnyの高水準Conversionが条件に応じコピーを選ぶことは、今回の複数区間の完全無劣化結合を保証しない。

### 5. 出力形式・元音声

最初のPoCは短い **H.264/AAC MP4** を対象候補とし、必要なエンコーダーの可否を実際のブラウザで確認する。WebM/Opusも別に検証する。成功をMP4という拡張子だけで示さず、生成されたファイル形式・video/audioコーデックを確かめる。iPhoneのHEVC/H.265・回転情報・可変フレームレート・複数音声・字幕の扱いは専用受け入れ項目とする。

- 元動画に音声がある場合、その音声を元動画区間で保持することを必須とする。説明区間中の元音声は停止し、マイク説明だけが聞こえる。
- 原音とナレーションを混ぜながら説明する機能は、最初の差し込みPoCには入れない。元音が存在しない場合は適切な無音区間を作る。
- 2本の音声や複数のオーディオトラックを単純に連結して済ませない。元音・挿入音を最終的に同期した1本の再生可能な音声トラックへまとめる条件を検証する。
- プレビューで聞こえるものと保存ファイルの音を一致させる。音声を欠落させて成功と表示しない。

### 6. スマホと単一HTMLの制約

- ユーザーファイルをサーバーへ送らず、File/Blobをブラウザ内で利用する。Mediabunny等のライブラリはビルド時に内包し、実行時CDNや追加ダウンロードを避ける。プライバシーの説明は実装の通信検証後に確定する。
- 250MiBの元ファイルに加え同等サイズの出力をメモリ上で丸ごと二重保持しない。BlobSource等による部分読込・Workerでの処理・出力先のStreamTargetを評価する。映像と音声の書き出しを近い時刻で進め、未処理の大量パケットを溜めない。
- File System Accessによる直接保存が使える端末では活用する。iPhone Safariの showSaveFilePicker には依存しない。非対応端末は検証済みのBlob／端末内一時領域／OS共有経路で安全に保存できる範囲を明示する。OPFSなどの一時保存も、端末・Safariごとに実際のデータを再デコードして確認する。
- WebCodecsのエンコーダー・デコーダー・音声形式は実行時判定し、利用できない場合に無理に成功扱いしない。非対応環境では機能を無効にし、入力と録音済み説明を勝手に捨てない。
- FFmpegビルダーの一部には GPL のx264をリンクするプロファイルがあり、MITの現アプリへ無検討に埋め込まない。配布ライセンス、ソース提供、NOTICEを確認する。MediabunnyはMPL-2.0の配布条件を確認し、内包時に著作権・ライセンス情報を維持する。
- 既存v0.9.3の5分／250MiB／10分／256MiBは連続録画に対する**試験上限**であり、新しい構成で自動的に保証しない。完成動画時間は「元動画時間＋挿入区間の合計」で算出して、新仕様の上限と中断・再開・保存条件を別途決める。

### 7. 画面設計（スマホ優先）

元動画プレビューと再生位置のすぐ下に **「この位置に説明を追加」** を主操作として配置する。タップすると元フレームを固定し、その画面上で既定のペン・丸・矢印・指差し、録音開始／終了確認を操作する。録り終えた説明は「10.0秒に8.1秒の説明」のように元動画時間へ紐付いた区間として表示し、タップで再生・再録音・削除できる。

元動画のシークを自由に行っても録画中の他区間が勝手に変更されない。「元動画の長さ」「追加した説明の合計時間」「完成見込み時間」を分けて表示する。保存前には全体プレビュー（擬似的な合成プレビューまたは実際の書き出し結果）を確認できること。通常の操作にWASM、mux、PTS等の技術用語を出さない。

### 8. 着手ゲートと受け入れ基準

| 段階（案） | 作るもの | 次段階へ進む条件 |
| --- | --- | --- |
| **PoC / v0.10.0案** | 1本の短い無音元動画、任意位置に1つの説明、音声＋描画を独立収録、合成保存 | 元動画の全フレーム区間が残り、説明映像・声が含まれ、完成長が概ね元長＋説明長、保存動画を別プレイヤーで再生できる |
| **v0.11.0案** | 原動画音声の保持、複数説明・削除・再録音・Undo、全体プレビュー | 2〜3挿入、同一時刻複数挿入、元音声の継続、説明中の元音停止、音声同期・元動画の縦横比・回転が検証済み |
| **v0.12.0案** | メモリ効率とコピー経路の検証、スマホ保存・中断回収、日英UX | Android Chrome/iPhone Safari/PC Chrome・Edge、MP4/WebM、音声あり/なし、再試行・中断・画面ロック・容量負荷で合否と対応可否が明示される |
| **v1.0.0判定** | README、スクリーンショット、単一HTML、CSP・通信・ライセンス・全回帰検証 | 利用者が編集→プレビュー→保存を完了できる。G9と新挿入ゲートが合格する |

受け入れでは実ファイルをffprobe等で検査し、挿入前後の元映像の欠落、先頭／末尾の切れ、説明中のフレーム連続性、原音とマイクの切替、音声同期目標±250ms（既存仕様）を確認する。**1本の実動画で完了するPoCが成功するまで**、v0.9.3の連続録画方式は既存ブランチ上で維持し、公開サイトへ移行しない。

### 9. 根拠・実装前に再確認する資料

- Mediabunny introduction: https://mediabunny.dev/guide/introduction
- Mediabunny conversion/copy/trim and composable conversion: https://mediabunny.dev/guide/converting-media-files
- Mediabunny output and large-file memory guidance: https://mediabunny.dev/guide/writing-media-files
- EncodedVideoPacketSource, decode-order contract: https://mediabunny.dev/api/EncodedVideoPacketSource
- StreamTarget (direct writable with offsets): https://mediabunny.dev/api/StreamTarget
- MDN WebCodecs (demux/mux outside the API): https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- MDN requestVideoFrameCallback / mediaTime: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
- FFmpeg concat demuxer and stream requirements: https://ffmpeg.org/ffmpeg-all.html
- Browser Kitty FFmpeg WASM Builder: https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder
- Browser Kitty Video Compressor / existing builder & GPL distribution reference: https://github.com/ttomohisa/htmlapps-video-compressor

**現時点の結論：** 説明区間のみを独立収録し、最終書き出しで元動画と結合する設計は技術的に成立する見込みがある。ただし現時点ではPoC未実施なので、音声保持・端末別保存・任意位置の無劣化挿入を「実現済み」とは扱わない。最初の実装は品質と結果の正しさを優先し、無劣化・高速書き出しは追加ゲートで判断する。
