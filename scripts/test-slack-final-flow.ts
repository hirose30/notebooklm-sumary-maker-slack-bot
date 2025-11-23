/**
 * Test: Complete flow verification
 * 1. Channel post (user posts URL)
 * 2. Thread reply "processing"
 * 3. Thread reply with audio/video links + infographic upload (single post)
 * 4. Delete "processing" message
 * 5. Channel post with thread link as "要約"
 */

import { WebClient } from '@slack/web-api';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function testFinalFlow() {
  const token = process.env.SLACK_WS1_BOT_TOKEN;
  if (!token) {
    throw new Error('SLACK_WS1_BOT_TOKEN not found');
  }

  const client = new WebClient(token);
  const testChannel = 'C05TH7AUCKG';

  console.log('🧪 Final Flow Verification Test\n');
  console.log('想定フロー:');
  console.log('1. チャンネルに通常の投稿 (example.com)');
  console.log('2. 処理中のスレッドへのリプライ');
  console.log('3. 音声・動画のリンクとコメント、インフォグラフィックのファイルアップロード（一つの投稿で）');
  console.log('4. 処理中の投稿の削除');
  console.log('5. 3のスレッドのURLを「要約」というテキストのリンクとして、チャンネルに投稿\n');

  try {
    const imagePath = resolve(process.cwd(), 'unnamed.png');
    const imageBuffer = readFileSync(imagePath);
    console.log(`✅ 画像読み込み: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);

    // Step 1: User posts URL to channel
    console.log('📝 Step 1: チャンネルに通常の投稿...');
    const userPost = await client.chat.postMessage({
      channel: testChannel,
      text: 'https://example.com/article',
    });
    const parentTs = userPost.ts!;
    console.log(`✅ ユーザー投稿: ${parentTs}\n`);

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Bot replies "processing" to thread
    console.log('📝 Step 2: スレッドに「処理中」リプライ...');
    const processingReply = await client.chat.postMessage({
      channel: testChannel,
      thread_ts: parentTs,
      text: '🔄 処理中です...',
    });
    const processingTs = processingReply.ts!;
    console.log(`✅ 処理中リプライ: ${processingTs}\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Upload infographic with audio/video links as initial_comment
    console.log('📤 Step 3: スレッドに音声・動画リンク + インフォグラフィックを投稿（1つの投稿）...');

    const completionMessage = '✅ 処理が完了しました！\n\n' +
      '🎵 <https://example.com/audio.m4a|音声要約> (33.4 MB)\n' +
      '🎬 <https://example.com/video.mp4|動画要約> (32.9 MB)\n\n' +
      '⏰ リンクは7日間有効です';

    const uploadResult = await client.files.uploadV2({
      channel_id: testChannel,
      thread_ts: parentTs,
      file: imageBuffer,
      filename: 'notebooklm-infographic.png',
      title: 'NotebookLM インフォグラフィック',
      initial_comment: completionMessage,
    });

    if (!uploadResult.ok) {
      throw new Error('File upload failed');
    }

    const files = (uploadResult as any).files;
    if (!files || files.length === 0) {
      throw new Error('No file returned from upload');
    }
    const fileData = files[0];

    console.log('✅ インフォグラフィック + リンクアップロード完了\n');

    // Get thread permalink for the file message with retry logic
    console.log('🔗 Step 3.5: ファイル投稿のパーマリンクを取得（リトライあり）...');

    let fileMessage: any = null;
    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`   試行 ${attempt}/${maxRetries}...`);

      // Search thread replies to find the file message
      const repliesResult = await client.conversations.replies({
        channel: testChannel,
        ts: parentTs,
      });

      const messages = (repliesResult as any).messages || [];
      console.log(`   スレッド内メッセージ数: ${messages.length}`);

      fileMessage = messages.find((m: any) => m.files && m.files.length > 0);

      if (fileMessage) {
        console.log(`   ✅ ファイルメッセージ発見: ${fileMessage.ts}\n`);
        break;
      }

      if (attempt < maxRetries) {
        console.log(`   ファイルメッセージが見つかりません。${retryDelay / 1000}秒後にリトライ...\n`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!fileMessage) {
      throw new Error('Could not find file message after 3 retries');
    }

    const permalinkResult = await client.chat.getPermalink({
      channel: testChannel,
      message_ts: fileMessage.ts,
    });

    const threadUrl = permalinkResult.permalink!;
    console.log(`✅ スレッドURL取得: ${threadUrl}\n`);

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Delete "processing" message
    console.log('🗑️  Step 4: 「処理中」メッセージを削除...');
    await client.chat.delete({
      channel: testChannel,
      ts: processingTs,
    });
    console.log('✅ 削除完了\n');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 5: Post channel message with thread link
    console.log('📢 Step 5: チャンネルに「要約」リンクを投稿...');
    const channelMessage = `<${threadUrl}|要約>`;

    const channelResult = await client.chat.postMessage({
      channel: testChannel,
      text: channelMessage,
    });

    console.log(`✅ チャンネル投稿完了: ${channelResult.ts}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ テスト完了！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Slackで確認してください:');
    console.log('1. ✓ チャンネルにユーザーの投稿がある (example.com)');
    console.log('2. ✓ そのスレッドに音声・動画リンク + インフォグラフィックが1つの投稿である');
    console.log('3. ✓ 「処理中」メッセージが削除されている');
    console.log('4. ✓ チャンネルに「要約」リンクが別途投稿されている');
    console.log('5. ✓ 「要約」リンクをクリックするとスレッドの該当投稿に移動する\n');

  } catch (error: any) {
    console.error('\n❌ エラー:', error.message || error);
    if (error.data) {
      console.error('詳細:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

testFinalFlow().catch(console.error);
