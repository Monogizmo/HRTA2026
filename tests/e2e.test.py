# รัน (ต้องมี playwright + เปิด http server ที่โฟลเดอร์โปรเจกต์ พอร์ต 8765):  python3 tests/e2e.test.py
from playwright.sync_api import sync_playwright
import re, sys
root='/home/claude/out/'
mock=open(root+'tests/e2e/mock-supabase.js',encoding='utf-8').read()
libs=''.join(open(root+'online/'+f,encoding='utf-8').read()+'\n' for f in ['nn-engine.js','nn-server.js','nn-api-core.js'])
def check(c,msg):
    print(('ok   ' if c else 'FAIL ')+msg)
    if not c: check.bad=True
check.bad=False
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/supabase.js', lambda r: r.fulfill(body=libs+mock,content_type='application/javascript'))
    pg.goto('http://localhost:8765/index.html',wait_until='networkidle')
    pg.click('text=เกม'); pg.click('[data-v="nn"]'); pg.wait_for_timeout(300)
    pg.click('#onlOpen'); pg.wait_for_timeout(500); pg.click('text=สร้างห้องใหม่')
    pg.fill('#onlName','เบียร์'); pg.click('#onlAvG button[data-v="เบียร์"]'); pg.click('[data-act="create"]'); pg.wait_for_timeout(900)
    check('3/4' in pg.inner_text('.onlInfo') or '3' in pg.inner_text('.onlInfo').split('\n')[0],'lobby shows 3 players')
    pg.click('[data-act="ready"]'); pg.wait_for_timeout(500)
    check(not pg.is_disabled('[data-act="start"]'),'start enabled when everyone ready')
    pg.click('[data-act="start"]'); pg.wait_for_timeout(1200)
    check(pg.is_visible('#nnT'),'offline-style table (#nnT) visible after start')
    check(pg.locator('#nnHand .nnC').count()==3,'my hand has 3 cards (.nnC like offline)')
    pub=pg.evaluate("JSON.stringify(HRTAOnline.state.game.public_state)")
    check(not re.search(r'"hands?"|"deck"|"disc"',pub),'public state has no hands/deck')
    check(pg.evaluate("HRTAOnline.state.hand.length")==3,'private hand loaded separately')
    shot=False; plays=0; over=False
    for i in range(900):
        pg.wait_for_timeout(250)
        if pg.locator('.nnRes').count(): over=True; break
        if pg.locator('#nnHand .nnHdr').count() and 'ตาของคุณ' in pg.inner_text('#nnHand .nnHdr'):
            btns=pg.locator('#nnHand .nnC:not(.dim)')
            if btns.count()==0: continue
            btns.nth(0).click(); pg.wait_for_timeout(100)
            pb=pg.locator('#nnHand .nnAct button')
            if pb.count():
                if not shot: pg.screenshot(path='/tmp/game.png'); shot=True
                pb.nth(0).click(); plays+=1; pg.wait_for_timeout(900)
    check(over,'game reached result screen (plays by me: %d)'%plays)
    if over:
        pg.screenshot(path='/tmp/result.png')
        txt=pg.inner_text('.nnRes'); print('RESULT:',txt.replace('\n',' | ')[:200])
        check('ทำกองเกิน' in txt and 'ผู้ชนะ' in txt,'result shows loser + winners')
        pg.click('[data-act="rematch"]'); pg.wait_for_timeout(1200)
        check(pg.locator('[data-act="ready"]').count()==1,'rematch returns to lobby')
        pg.click('[data-act="ready"]'); pg.wait_for_timeout(500); pg.click('[data-act="start"]'); pg.wait_for_timeout(1200)
        check(pg.evaluate("HRTAOnline.state.game.round_no")==2,'second round started (round_no=2)')
    print('page errors:',[e for e in errs][:3])
    check(len(errs)==0,'no JS page errors')
    b.close()
sys.exit(1 if check.bad else 0)
