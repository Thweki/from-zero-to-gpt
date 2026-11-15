import {useSyncExternalStore} from 'react';
import {offlineEnabled, offlineSnapshot, subscribeOffline} from '../offline-reading';

export function OfflineReading() {
  const status = useSyncExternalStore(subscribeOffline, offlineSnapshot);
  if (!offlineEnabled) return null;
  return <section className="settings-card" aria-label="离线阅读 · 实验性">
    <h2>离线阅读 · 实验性</h2>
    <p role="status">{status === 'ready' ? '教材已可离线重开。' : status === 'unavailable' ? '离线缓存不可用，请联网阅读并检查浏览器存储空间。' : '正在准备离线教材，请保持联网…'}</p>
    <p>保留教材、公式、字体和图形实验。Python 运行时、工程下载与 AI 导师仍需连接服务。浏览器可能清理缓存；学习数据请另行导出备份。</p>
    <p className="small-note">更新后请关闭本站全部标签页再打开，以使用新版教材。</p>
  </section>;
}
