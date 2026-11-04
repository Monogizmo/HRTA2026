# รัน (ต้องมี playwright + เปิด http server ที่โฟลเดอร์โปรเจกต์ พอร์ต 8765):  python3 tests/e2e.test.py
# เล่นครบเกมใน Chromium ด้วยตรรกะเซิร์ฟเวอร์ตัวจริง + ฐานข้อมูลจำลอง + บอท 2 ตัว ทั้งโหมดแพ้ 1 คน และคัดออก
from playwright.sync_api import sync_playwright
import re, sys, shutil
from pathlib import Path
root=str(Path(__file__).resolve().parents[1])+'/'
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
    if mode == 'one_loser':
        check(pg.locator('[data-act="nfs"]').count()==1,tag+'fullscreen/landscape toggle is available')
        # Fool: show a target button for every live player and submit the selected card ID.
        pg.evaluate('window.__forceCardTurn(0)'); pg.wait_for_timeout(450)
        pg.click('#nnHand .nnC[data-v="100000"]'); pg.wait_for_timeout(150)
        check(pg.locator('#nnHand [data-act="ntarget"]').count()==3,tag+'Fool exposes all 3 live target choices')
        target=2
        pg.click('#nnHand [data-act="ntarget"][data-v="%d"]'%target); pg.wait_for_timeout(2200)
        check(pg.evaluate('HRTAOnline.state.game.public_state.last.nx')==target,tag+'Fool target reaches server with correct player ID')
        # Emperor: only opponents are selectable; chosen opponent becomes sealed.
        pg.evaluate('window.__forceCardTurn(4)'); pg.wait_for_timeout(450)
        pg.click('#nnHand .nnC[data-v="100040"]'); pg.wait_for_timeout(150)
        check(pg.locator('#nnHand [data-act="ntarget"]').count()==2,tag+'Emperor exposes the 2 opponent choices')
        target=1
        pg.click('#nnHand [data-act="ntarget"][data-v="%d"]'%target); pg.wait_for_timeout(2200)
        check(pg.evaluate('HRTAOnline.state.game.public_state.sealed[%d]'%target),tag+'Emperor seals the chosen opponent')
        # Moon: select a non-current, non-next opponent so the live reveal remains visible.
        pg.evaluate('window.__forceCardTurn(18)'); pg.wait_for_timeout(450)
        pg.click('#nnHand .nnC[data-v="100180"]'); pg.wait_for_timeout(100)
        check(pg.locator('#nnHand [data-act="ntarget"]').count()==2,tag+'Moon exposes opponent-only target choices')
        target=2
        pg.click('#nnHand [data-act="ntarget"][data-v="%d"]'%target); pg.wait_for_timeout(2200)
        check(pg.evaluate('HRTAOnline.state.game.public_state.revealed')==target,tag+'Moon reveal reaches public state for selected opponent')
        # Chariot: after landing, both continue-with-card and skip paths must be available.
        pg.evaluate('window.__forceCardTurn(7)'); pg.wait_for_timeout(450)
        pg.click('#nnHand .nnC[data-v="100070"]'); pg.wait_for_timeout(100)
        pg.click('#nnHand [data-act="nopt"][data-card-id="100070"]'); pg.wait_for_timeout(2200)
        check(pg.evaluate("HRTAOnline.state.game.public_state.pending.type")=='chariot',tag+'Chariot enters explicit pending-choice state')
        check(pg.locator('#nnHand [data-act="nskip"]').count()==1,tag+'Chariot skip button is visible')
        pg.click('#nnHand .nnC[data-v="100071"]'); pg.wait_for_timeout(100)
        check(pg.locator('#nnHand [data-act="nopt"][data-card-id="100071"]').count()==1,tag+'Chariot second-card play option is visible')
        pg.click('#nnHand [data-act="nopt"][data-card-id="100071"]'); pg.wait_for_timeout(2200)
        check(pg.evaluate("HRTAOnline.state.game.public_state.pending===null && HRTAOnline.state.game.public_state.last.n===1"),tag+'Chariot second-card action resolves')
        # Check skip path in a separate forced Chariot turn.
        pg.evaluate('window.__forceCardTurn(7)'); pg.wait_for_timeout(450)
        pg.click('#nnHand .nnC[data-v="100070"]'); pg.wait_for_timeout(100)
        pg.click('#nnHand [data-act="nopt"][data-card-id="100070"]'); pg.wait_for_timeout(2200)
        check(pg.locator('#nnHand [data-act="nskip"]').count()==1,tag+'Chariot skip stays available after a fresh first card')
        pg.click('#nnHand [data-act="nskip"]'); pg.wait_for_timeout(1200)
        check(pg.evaluate("HRTAOnline.state.game.public_state.pending===null"),tag+'Chariot skip resolves and clears pending state')
        # Star: signed value selection is bound to the physical card ID.
        pg.evaluate('window.__forceStarTurn(-17)'); pg.wait_for_timeout(450)
        pg.click('#nnHand .nnC[data-v="17017"]'); pg.wait_for_timeout(120)
        check(pg.locator('#nnHand [data-act="nvalue"]').count()==2,tag+'Star exposes both -17/+17 choices')
        pg.click('#nnHand [data-act="nvalue"][data-v="-17"]'); pg.wait_for_timeout(1500)
        check(pg.evaluate('HRTAOnline.state.game.public_state.last.n')==17,tag+'Star choice reaches online server')
        check(pg.evaluate('HRTAOnline.state.game.public_state.total')==83,tag+'online Star -17 resolves to expected score')
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
    system_chromium = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
    launch = {'executable_path': system_chromium, 'args': ['--no-sandbox']} if system_chromium else {}
    b=p.chromium.launch(**launch)
    scenario(b,'one_loser'); scenario(b,'elimination')
    b.close()
sys.exit(1 if check.bad else 0)
