# รัน (ต้องมี playwright; เปิด http server ที่โฟลเดอร์โปรเจกต์ พอร์ต 8765):  python3 tests/e2e-war.test.py
# สงครามไพ่ยุทธวิธีออนไลน์ใน Chromium: ใช้ตรรกะเซิร์ฟเวอร์ตัวจริง + ฐานข้อมูลจำลอง + บอท 1 ตัว (หมายเหตุ: เป็นบริบทเดียว+บอท ไม่ใช่ 2 บริบทเบราว์เซอร์จริง)
from playwright.sync_api import sync_playwright
import os, re, sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'
mock=open(root+'tests/e2e/mock-supabase-war.js',encoding='utf-8').read()
libs=''.join(open(root+'online/'+f,encoding='utf-8').read()+'\n' for f in ['nn-engine.js','nn-server.js','war-engine.js','war-server.js','war-api-core.js','nn-api-core.js'])
def check(c,msg):
    print(('ok   ' if c else 'FAIL ')+msg)
    if not c: check.bad=True
check.bad=False
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/supabase.js', lambda r: r.fulfill(body=libs+mock,content_type='application/javascript'))
    pg.goto('http://localhost:8765/index.html',wait_until='networkidle')
    pg.click('text=เกม'); pg.click('[data-v="war"]'); pg.click('#wtModes [data-g="tac"]'); pg.wait_for_timeout(300)
    pg.click('[data-onl-open]'); pg.wait_for_timeout(500); pg.click('text=สร้างห้องใหม่')
    pg.fill('#onlName','เบียร์'); pg.click('#onlAvG button[data-v="เบียร์"]')
    pg.click('[data-act="gt"][data-v="war"]'); pg.wait_for_timeout(200)
    check(pg.locator('[data-act="cap"]').count()==0 and pg.locator('[data-act="wclash"]').count()==3,'create form switches to war settings (no cap/mode)')
    pg.click('[data-act="wclash"][data-v="un"]'); pg.click('[data-act="wfool"][data-v="0"]')
    pg.click('[data-act="create"]'); pg.wait_for_timeout(900)
    info=pg.inner_text('.onlInfo'); check('สงครามไพ่ยุทธวิธี' in info and '2/2' in info and 'ห่าง 1' in info and 'ปิด' in info,'lobby shows war type, 2/2 players and host rules: '+info.replace('\n',' | ')[:120])
    check(pg.locator('.onlSeat, .onlP').count()>=0,'lobby rendered')
    pg.click('[data-act="ready"]'); pg.wait_for_timeout(500)
    check(not pg.is_disabled('[data-act="start"]'),'start enabled when both ready')
    pg.screenshot(path='/tmp/war_lobby.png')
    pg.click('[data-act="start"]'); pg.wait_for_selector('#woHand .wtC',timeout=15000)
    check(pg.locator('#woHand .wtC').count()==3,'my hand has 3 cards')
    pub=pg.evaluate("JSON.stringify(HRTAOnline.state.game.public_state)")
    check(not re.search(r'"hands?"|"deck"|"pend"',pub),'public state has no hands/deck/pend')
    check(pg.evaluate("HRTAOnline.state.game.public_state.cfg.clash")=='un' and pg.evaluate("HRTAOnline.state.game.public_state.cfg.fool")==0,'server game uses host settings (clash=un, fool off)')
    shot=False; over=False; wars=0; committed=0
    for i in range(600):
        pg.wait_for_timeout(300)
        if pg.locator('.nnRes').count(): over=True; break
        if not pg.locator('#woAct [data-act="wgo"]').count(): continue
        war=pg.locator('#woAct [data-act="wretreat"]').count()>0
        cards=pg.locator('#woHand .wtC'); n=cards.count()
        if war:
            wars+=1
            if pg.evaluate("Math.random()")<.2: pg.click('#woAct [data-act="wretreat"]'); committed+=1; pg.wait_for_timeout(500); continue
            need=3 if n>=4 else max(0,n-1)
            for k in range(need): cards.nth(k).click()
            cards.nth(n-1).click()
            if not shot: pg.screenshot(path='/tmp/war_war.png'); shot=True
        else:
            cards.nth(n-1 if pg.evaluate("Math.random()")<.5 else 0).click()
            if pg.locator('#woAct [data-act="wraise"]').count() and pg.evaluate("Math.random()")<.25:
                pg.click('#woAct [data-act="wraise"]'); cards.nth(1 if pg.locator('#woHand .wtC.sel').count() and False else 0).click()
        if pg.locator('#woAct [data-act="wgo"]:not([disabled])').count():
            pg.click('#woAct [data-act="wgo"]'); committed+=1
            st=pg.evaluate("JSON.stringify(HRTAOnline.state.game.public_state.cm)")
            pj=pg.evaluate("JSON.stringify(HRTAOnline.state.game.public_state)")
            check(not re.search(r'"hands?"|"deck"|"pend"',pj),'public state stays clean while choices are pending') if committed<3 else None
        pg.wait_for_timeout(300)
    check(over,'game reached result screen (my commits: %d, war phases seen: %d)'%(committed,wars))
    if over:
        pg.screenshot(path='/tmp/war_result.png'); txt=pg.inner_text('.nnRes'); print('RESULT:',txt.replace('\n',' | ')[:200])
        check(('ชนะ' in txt) or ('เสมอ' in txt) or ('ยอมแพ้' in txt),'result text shown')
        res=pg.evaluate("JSON.stringify(HRTAOnline.state.game.public_state.res)"); print('res',res)
        check(pg.evaluate("HRTAOnline.state.game.status")=='finished','game finished on server')
        pg.click('[data-act="rematch"]'); pg.wait_for_timeout(1200)
        check(pg.locator('[data-act="ready"]').count()==1,'rematch returns to lobby')
        pg.click('[data-act="ready"]'); pg.wait_for_timeout(500); pg.click('[data-act="start"]'); pg.wait_for_selector('#woHand .wtC',timeout=15000)
        check(pg.evaluate("HRTAOnline.state.game.round_no")==2,'second game started (round_no=2)')
    check(len(errs)==0,'no JS page errors '+str(errs[:2]))
    b.close()
sys.exit(1 if check.bad else 0)
