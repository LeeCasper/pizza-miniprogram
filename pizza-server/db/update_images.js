/**
 * 更新生产数据库中的产品图片 URL（从 Unsplash → Google aida-public）
 * 在服务器上运行: node db/update_images.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

const productUpdates = [
  ['经典玛格丽特披萨', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBp8EOysOBJocEYpVmA0C5Te_SBlXWmE4NWNxR1drJSYTTlVmysZfMg6UlVSAnQEqiD-bUTXOILpZoFDkxXA776U1NA4R2vZOI6hEJ4rLwxzSnUxbjO1GlcIHwLiC_1HkRW0q6q1ozxQNV1HWmDaiiEDc6u7P6bFRVtb5qbX5qpeiknrdCwGmf4SNilH_pYYYiTweRhwcStE_vhh-m4mArcRLxjHVy05PJ1NErClMgclPfwQkL5hfyJWVM7yibYsXMgrFG-92ItMhhv'],
  ['超级至尊披萨', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0'],
  ['夏威夷风情披萨', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH'],
  ['猫山王榴莲披萨', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI'],
  ['金枕头榴莲披萨', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH'],
  ['凤梨酥', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI'],
  ['芝士凤梨酥', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0'],
];

const ptsUpdates = [
  ['超级至尊披萨兑换券', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0'],
  ['猫山王榴莲披萨兑换券', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI'],
  ['买一送一券', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH'],
  ['满100减15优惠券', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI'],
  ['限量定制马克杯', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0'],
];

async function run() {
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✓ Database connected');
  } catch (e) {
    console.error('✗ Database connection failed:', e.message);
    console.error('  Ensure you run this ON the production server where .env is configured.');
    process.exit(1);
  }

  let changed = 0;

  // Update products
  for (const [name, newUrl] of productUpdates) {
    try {
      const [result] = await pool.query(
        "UPDATE products SET image = ? WHERE name = ? AND image LIKE '%unsplash%'",
        [newUrl, name]
      );
      if (result.affectedRows > 0) {
        console.log(`✓ product: ${name}`);
        changed++;
      } else {
        console.log(`- product: ${name} (already updated or not found)`);
      }
    } catch (e) {
      console.error(`✗ product: ${name} — ${e.message}`);
    }
  }

  // Clear category icons
  try {
    const [result] = await pool.query("UPDATE categories SET icon = ''");
    console.log(`✓ categories: icons cleared (${result.affectedRows} rows)`);
    changed += result.affectedRows;
  } catch (e) {
    console.error(`✗ categories: ${e.message}`);
  }

  // Update points_products
  for (const [name, newUrl] of ptsUpdates) {
    try {
      const [result] = await pool.query(
        "UPDATE points_products SET image = ? WHERE name = ? AND image LIKE '%unsplash%'",
        [newUrl, name]
      );
      if (result.affectedRows > 0) {
        console.log(`✓ points_products: ${name}`);
        changed++;
      } else {
        console.log(`- points_products: ${name} (already updated or not found)`);
      }
    } catch (e) {
      console.error(`✗ points_products: ${name} — ${e.message}`);
    }
  }

  console.log(`\nDone — ${changed} rows updated.`);
  process.exit(0);
}

run();
