# รัน (ต้องมี playwright + เปิด http server ที่โฟลเดอร์โปรเจกต์ พอร์ต 8765):  python3 tests/e2e.test.py
# เล่นครบเกมใน Chromium ด้วยตรรกะเซิร์ฟเวอร์ตัวจริง + ฐานข้อมูลจำลอง + บอท 2 ตัว ทั้งโหมดแพ้ 1 คน และคัดออก
from playwright.sync_api import sync_playwright
import re, sys
root='/home/claude/out/'
mock=open(root+'tests/e2e/mock-supabase.js',encoding='utf-8').read()
libs=''.join(open(root+'online/'+f,encoding='utf-8').read()+'\n' for f in ['nn-engine.js','nn-server.js','nn-api-core.js'])
def check(c,msg):
    print(('ok   ' if c else 'FAIL ')+msg)
    if not c: check.bad=True
check.bad=False

def scenario(b, mode):
    tag='['+mode+'] '
    ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/supabase.js', lambda r: r.fulfill(body=libs+mock,content_type='application/javascript'))
    pg.goto('http://localhost:8765/index.html',wait_until='networkidle')
    pg.click('text=เกม'); pg.click('[data-v="nn"]'); pg.wait_for_timeout(300)
    pg.click('#onlOpen'); pg.wait_for_timeout(500); pg.click('text=สร้างห้องใหม่')
    pg.fill('#onlName','เบียร์'); pg.click('#onlAvG button[data-v="เบียร์"]')
    pg.click('[data-act="mode"][data-v="%s"]'%mode)
    pg.click('[data-act="create"]'); pg.wait_for_timeout(900)
    check('3' in pg.inner_text('.onlInfo').split('\n')[0],tag+'lobby shows 3 players')
    pg.click('[data-act="ready"]'); pg.wait_for_timeout(500)
    check(not pg.is_disabled('[data-act="start"]'),tag+'start enabled when everyone ready')
    pg.click('[data-act="start"]'); pg.wait_for_timeout(1200)
    check(pg.is_visible('#nnT'),tag+'offline-style table (#nnT) visible after start')
    check(pg.locator('#nnHand .nnC').count()==3,tag+'my hand has 3 cards (.nnC like offline)')
    pub=pg.evaluate("JSON.stringify(HRTAOnline.state.game.public_state)")
    check(not re.search(r'"hands?"|"deck"|"disc"',pub),tag+'public state has no hands/deck')
    check(pg.evaluate("HRTAOnline.state.game.public_state.mode")==mode,tag+'game mode = '+mode)
    plays=0; over=False; sawOut=False
    for i in range(1400):
        pg.wait_for_timeout(250)
        if pg.locator('.nnRes').count(): over=True; break
        if pg.locator('.nnSeat.out').count(): sawOut=True
        if pg.locator('#nnHand .nnHdr').count() and 'ตาของคุณ' in pg.inner_text('#nnHand .nnHdr'):
            btns=pg.locator('#nnHand .nnC:not(.dim)')
            if btns.count()==0: continue
            btns.nth(0).click(); pg.wait_for_timeout(100)
            pb=pg.locator('#nnHand .nnAct button')
            if pb.count():
                if plays==0: pg.screenshot(path='/tmp/game_%s.png'%mode)
                pb.nth(0).click(); plays+=1; pg.wait_for_timeout(900)
    check(over,tag+'game reached result screen (plays by me: %d)'%plays)
    if over:
        pg.screenshot(path='/tmp/result_%s.png'%mode)
        txt=pg.inner_text('.nnRes'); print('RESULT:',txt.replace('\n',' | ')[:220])
        if mode=='one_loser': check('ทำกองเกิน' in txt and 'ผู้ชนะ' in txt,tag+'result shows loser + winners')
        else:
            check('🥇' in txt and ('คือผู้ชนะ' in txt),tag+'result shows placements (winner + ranks)')
            check(pg.evaluate("HRTAOnline.state.game.public_state.out.length")==2,tag+'2 players eliminated (3 -> winner)')
        pg.click('[data-act="rematch"]'); pg.wait_for_timeout(1200)
        check(pg.locator('[data-act="ready"]').count()==1,tag+'rematch returns to lobby')
        pg.click('[data-act="ready"]'); pg.wait_for_timeout(500); pg.click('[data-act="start"]'); pg.wait_for_timeout(1500)
        check(pg.evaluate("HRTAOnline.state.game.round_no")==2,tag+'second round started (round_no=2)')
    check(len(errs)==0,tag+'no JS page errors '+str(errs[:2]))
    ctx.close()

with sync_playwright() as p:
    b=p.chromium.launch()
    scenario(b,'one_loser'); scenario(b,'elimination')
    b.close()
sys.exit(1 if check.bad else 0)
