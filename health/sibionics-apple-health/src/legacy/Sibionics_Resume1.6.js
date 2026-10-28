// SiBionics permission-failure recovery v1.6.
// Uses the EXISTING 硅基血糖写入v1.5 Shortcut. No XLSX conversion or new writer.
// Explicit zero-write confirmation is required: JS cannot inspect HealthKit.
// Does not delete completed records, batch rows, backups, or any Health samples.
const VERSION = '1.6';
const WRITER = '硅基血糖写入v1.5';
const fm = FileManager.local();
const path = fm.joinPath(fm.documentsDirectory(), 'sibionics_health_import_v14_state.json');
async function message(title, text) {
  const a = new Alert(); a.title = title; a.message = text;
  a.addAction('确定'); await a.presentAlert();
}
async function main() {
  if (!fm.fileExists(path)) throw new Error('没有找到待导入数据。请先用原来的 v1.5 选择 Excel。');
  const before = fm.readString(path);
  let state;
  try { state = JSON.parse(before); } catch (_) { throw new Error('本地记录无法读取，未修改或删除任何文件。'); }
  if (!state || state.version !== 2 || !state.completed || typeof state.completed !== 'object' || Array.isArray(state.completed))
    throw new Error('本地记录结构不符，未修改任何文件。');
  const batch = state.active;
  if (!batch) {
    await message('无需恢复', '没有未完成批次。请在苹果健康查看记录；不要重复导入已经成功的数据。');
    Script.complete(); return;
  }
  if (!['prepared', 'running'].includes(batch.status) || !Array.isArray(batch.rows) || batch.rows.length === 0)
    throw new Error('待导入批次格式不符，未修改任何文件。');
  if (typeof batch.token !== 'string' || !/^SIBIONICS-CGM-V15\|[a-z0-9-]{30,}$/.test(batch.token))
    throw new Error('这不是 v1.5 的待导入批次；未强行转换或启动旧版本。');
  for (const row of batch.rows) {
    if (!Array.isArray(row) || row.length !== 2 || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row[0]) ||
        !Number.isFinite(Number(row[1])) || Number(row[1]) <= 0 || Number(row[1]) > 40)
      throw new Error('待导入数据不完整，未修改批次。');
    if (Object.prototype.hasOwnProperty.call(state.completed, row[0]))
      throw new Error('待导入批次与已完成记录重叠。为免重复，不会重新提交。');
  }
  const a = new Alert();
  a.title = '恢复权限失败的导入 · v1.6';
  a.message = '已找到原来的 ' + batch.rows.length + ' 条，无需再选 Excel。\n\n' +
    '先到：健康 → 头像 → App → 快捷指令，允许写入“血糖”。\n\n' +
    '仅在上一轮因权限拒绝、没有成功写入任何记录时重试。若已经写入过一部分，请取消，避免重复。';
  a.addAction('已允许写入，且上次未写入：继续');
  a.addCancelAction('取消');
  if (await a.presentAlert() !== 0) { Script.complete(); return; }
  // Do not overwrite a receipt or a newer batch written while the dialog was open.
  if (fm.readString(path) !== before) throw new Error('批次期间已发生变化，未覆盖新进度。请关闭其他运行后再试。');
  const backup = path + '.before_resume_v16_' + Date.now() + '.bak';
  fm.writeString(backup, before);
  if (fm.readString(backup) !== before) throw new Error('原记录备份校验失败，未修改主文件。');
  // The user explicitly confirmed this prior attempt wrote ZERO Health samples.
  // Only release the stale start flag; preserve the batch token, rows and completed map.
  state.active.status = 'prepared';
  state.active.resumeConfirmedAt = new Date().toISOString();
  state.active.resumeConfirmation = 'user-confirmed-zero-writes-after-permission-error';
  const updated = JSON.stringify(state);
  fm.writeString(path, updated); // overwrite, never move a .tmp onto an existing file
  if (fm.readString(path) !== updated) throw new Error('恢复状态写入失败，未启动快捷指令。');
  Pasteboard.copy(batch.token);
  Safari.open('shortcuts://run-shortcut?name=' + encodeURIComponent(WRITER) + '&input=clipboard');
  Script.complete();
}
try { await main(); }
catch (e) {
  await message('恢复未执行', String(e.message || e));
  Script.complete();
}
