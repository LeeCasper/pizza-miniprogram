import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('39.107.77.26', username='root', password='licongLee2003', port=22)

def mysql_query(sql):
    """Execute a MySQL query and return (success, message)."""
    # Write SQL to temp file to avoid shell escaping + encoding issues
    stdin, stdout, stderr = ssh.exec_command(
        "mysql -u root --password='licong' --default-character-set=utf8mb4 pizza 2>&1",
        get_pty=False
    )
    stdin.write(sql.encode('utf-8'))
    stdin.close()
    output = stdout.read().decode('utf-8', errors='replace')
    # Filter out the password warning
    lines = [l for l in output.split('\n') if 'password on the command line' not in l and l.strip()]
    return lines

# ── First check what needs updating ──
print("=== Checking products with Unsplash URLs ===")
result = mysql_query("SELECT id, name, image FROM products WHERE image LIKE '%unsplash%';")
for line in result:
    print("  ", line)

print("\n=== Checking points_products with Unsplash URLs ===")
result = mysql_query("SELECT id, name, image FROM points_products WHERE image LIKE '%unsplash%';")
for line in result:
    print("  ", line)

print("\n=== Checking categories ===")
result = mysql_query("SELECT id, name, icon FROM categories;")
for line in result:
    print("  ", line)

# ── Update products ──
updates = [
    ("经典玛格丽特披萨", "https://lh3.googleusercontent.com/aida-public/AB6AXuBp8EOysOBJocEYpVmA0C5Te_SBlXWmE4NWNxR1drJSYTTlVmysZfMg6UlVSAnQEqiD-bUTXOILpZoFDkxXA776U1NA4R2vZOI6hEJ4rLwxzSnUxbjO1GlcIHwLiC_1HkRW0q6q1ozxQNV1HWmDaiiEDc6u7P6bFRVtb5qbX5qpeiknrdCwGmf4SNilH_pYYYiTweRhwcStE_vhh-m4mArcRLxjHVy05PJ1NErClMgclPfwQkL5hfyJWVM7yibYsXMgrFG-92ItMhhv"),
    ("超级至尊披萨", "https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0"),
    ("夏威夷风情披萨", "https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH"),
    ("猫山王榴莲披萨", "https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI"),
    ("金枕头榴莲披萨", "https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH"),
    ("凤梨酥", "https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI"),
    ("芝士凤梨酥", "https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0"),
]

print("\n=== Updating products ===")
for name, new_url in updates:
    sql = "UPDATE products SET image = '{}' WHERE name = '{}' AND image LIKE '%unsplash%';".format(new_url, name)
    lines = mysql_query(sql)
    # Check affected rows
    result = mysql_query("SELECT ROW_COUNT() AS affected;")
    print("  {}: {}".format(name, result))

# Clear category icons
print("\n=== Clearing category icons ===")
result = mysql_query("UPDATE categories SET icon = '' WHERE icon != '';")
print("  Categories:", result)
result = mysql_query("SELECT ROW_COUNT() AS affected;")
print("  Rows:", result)

# Update points_products
pts_updates = [
    ("超级至尊披萨兑换券", "https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0"),
    ("猫山王榴莲披萨兑换券", "https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI"),
    ("买一送一券", "https://lh3.googleusercontent.com/aida-public/AB6AXuCWmaxqTd2O050Z_YxQSKXsT5_oVWDC06lxugCoBCFCzcZUIJBgIHrEzfVye-VzfyH7dbUZ-qVedHehug_qhNKPvDklpIekjq3ZNQ5CneDJa5ff5swVizK5TLUUrqfXGsDAuOZ0VjZP5CAxAyFcRoQbeoOVsYXcFDNuoNcl0aR72Ln48aphvlFVcJMFVoMEeLAAaKZF_AQoSS2tHk5U9-wVNEBAmlA53xjX0-GyKcZZ9Ol_EficZ5oKx7_7T_r5SsnWpdCUa3Rc78tH"),
    ("满100减15优惠券", "https://lh3.googleusercontent.com/aida-public/AB6AXuBayQZY0m6b2R34EAdzygEG-UK23Fh6BXF7XPpyFgnj_5ifAvPH0Kg9SZYTa5REbC2XJqG-i1tytd1XePzU3T5mL3tIeAeXxSTmeeNp6Wohvm7btspHnRPleWW8WztkLnwMPawA1hFiPloxtSuaee-HabmGodtLQ8DW1SirgU71WtroUGEhGFXjYijR6qpfie_jnZ_RIZerNh5d0C1ulTT25N6htHikAOdQYC5qlEIskjDWDjQNybwu6yRVGm_I-yKZbJykcM007JYI"),
    ("限量定制马克杯", "https://lh3.googleusercontent.com/aida-public/AB6AXuBHwAGsGxydcKUMMQl5X5puUge21D0mVMFbFLCEc0iKIi2RdvgffpzXlzNmHhDAHoelY_HLqmJ_IHTYHK3nJ4iH5fsH_iIrr-HjZwIgO17ZaX0RWUyTmeu3M07vBHeeVLZXfJWBuhJ7JxeUQd7nJ6XSyoEwEYxfMfH1SktJ0is9YuGWv5CuGyxSQubPl-rWzHlBO8FzGphncRXgagX-akkecaLO0wiigEMyYLt8gRJ004tZpBcpuvuI17Xl1nvZq1nwz0Veb8WF4st0"),
]

print("\n=== Updating points_products ===")
for name, new_url in pts_updates:
    sql = "UPDATE points_products SET image = '{}' WHERE name = '{}' AND image LIKE '%unsplash%';".format(new_url, name)
    lines = mysql_query(sql)
    result = mysql_query("SELECT ROW_COUNT() AS affected;")
    print("  {}: {}".format(name, result))

# Final verification
print("\n=== Final check: products ===")
result = mysql_query("SELECT id, name, SUBSTRING(image, 1, 60) AS image_prefix FROM products;")
for line in result:
    print("  ", line)

print("\n=== Final check: points_products ===")
result = mysql_query("SELECT id, name, SUBSTRING(image, 1, 60) AS image_prefix FROM points_products;")
for line in result:
    print("  ", line)

ssh.close()
print("\nDone")
