/**
 * UI Selector Factory
 *
 * UIバージョン別のセレクタセットを提供するファクトリクラス
 * Factory Patternにより、バージョン切り替えロジックを一箇所に集約
 */

import type { UISelector } from '../lib/ui-selectors/types.js';
import { oldUISelectors } from '../lib/ui-selectors/old-ui.js';
import { newUISelectors } from '../lib/ui-selectors/new-ui.js';
import type { UIVersion } from '../models/ui-version.js';

/**
 * UISelectorFactory
 *
 * UIバージョンに応じた適切なセレクタセットを返す
 */
export class UISelectorFactory {
  /**
   * UIバージョンに応じたセレクタセットを取得
   *
   * @param version - UIバージョン ('old' | 'new')
   * @returns UISelector - セレクタセット
   * @throws Error - 無効なバージョンの場合
   */
  getSelectors(version: UIVersion): UISelector {
    switch (version) {
      case 'old':
        return oldUISelectors;
      case 'new':
        // T021: 新UIセレクタを返す
        return newUISelectors;
      default:
        throw new Error(`Unsupported UI version: ${version}`);
    }
  }

  /**
   * サポートされているUIバージョン一覧を取得
   *
   * @returns UIVersion[] - バージョン文字列の配列
   */
  getSupportedVersions(): UIVersion[] {
    return ['old', 'new'];
  }
}
