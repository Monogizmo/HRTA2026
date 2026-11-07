# รัน (ต้องมี playwright; http server ที่โฟลเดอร์โปรเจกต์ พอร์ต 8765):  python3 tests/e2e-war-2ctx.test.py
# สงครามไพ่ออนไลน์ "2 เบราว์เซอร์จริง" ที่ใช้เซิร์ฟเวอร์จำลองตัวเดียวกัน (tests/e2e/two-ctx-server.js รันตรรกะ Edge Function ตัวจริง):
# สร้างห้อง→เข้าห้องด้วยรหัส→พร้อม→เริ่ม→เล่นจนจบ (กดพร้อมกัน)→Rematch→ยอมแพ้กลางเกม ; ตรวจว่าความลับไม่รั่วและสองหน้าจอเห็นผลตรงกัน
from playwright.sync_api import sync_playwright
import os, sys, subprocess, time, re, random, json, urllib.request
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'
PORT=8771; SRV='http://localhost:%d'%PORT
mock=open(root+'tests/e2e/mock-client-2ctx.js',encoding='utf-8').read()
def check(c,msg):
    print(('ok   ' if c else 'FAIL ')+msg)
    if not c: check.bad=True
check.bad=False
srv=subprocess.Popen(['node',root+'tests/e2e/two-ctx-server.js',str(PORT)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
time.sleep(1.2)
UA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; UB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
def dump(): return json.loads(urllib.request.urlopen(SRV+'/dump').read())
def newpage(b,user):
    ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.add_init_script("window.__USER='%s';window.__SRV='%s';"%(user,SRV)+mock)
    pg.goto('http://localhost:8765/index.html',wait_until='load'); pg.wait_for_timeout(800); pg.errs=errs
    pg.click('text=เกม'); pg.click('[data-v="war"]'); pg.click('#wtModes [data-g="tac"]'); pg.wait_for_timeout(200)
    pg.click('[data-onl-open]'); pg.wait_for_timeout(600); return pg
def act(pg):
    """เล่น 1 จังหวะ ถ้าถึงตา: คืน True ถ้ากดยืนยันแล้ว"""
    if not pg.locator('#woAct [data-act="wgo"]').count(): return False
    cards=pg.locator('#woHand .wtC'); n=cards.count()
    if n==0: return False
    if pg.locator('#woAct [data-act="wretreat"]').count():
        if random.random()<.2: pg.click('#woAct [data-act="wretreat"]'); return True
        need=3 if n>=4 else max(0,n-1)
        for k in range(need): cards.nth(k).click()
        cards.nth(n-1).click()
    else:
        cards.nth(n-1 if random.random()<.5 else 0).click()
        if pg.locator('#woAct [data-act="wraise"]').count() and random.random()<.25:
            pg.click('#woAct [data-act="wraise"]'); cards.nth(0).click() if pg.locator('#woHand .wtC.sel').count()==0 else None
    if pg.locator('#woAct [data-act="wgo"]:not([disabled])').count(): pg.evaluate("document.querySelector('#woAct [data-act=wgo]').click()"); return True
    return False
def play_to_end(A,B,limit=240):
    t0=time.time(); races=0
    while time.time()-t0<limit:
        if A.locator('.nnRes').count() and B.locator('.nnRes').count(): return True
        da=act(A); db=act(B)
        if da and db: races+=1
        A.wait_for_timeout(200)
    return False
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); A=newpage(b,UA); B=newpage(b,UB)
    A.click('text=สร้างห้องใหม่'); A.fill('#onlName','เบียร์'); A.click('#onlAvG button[data-v="เบียร์"]'); A.click('[data-act="gt"][data-v="war"]')
    A.click('[data-act="wclash"][data-v="un"]'); A.click('[data-act="create"]'); A.wait_for_timeout(1000)
    code=A.evaluate("HRTAOnline.state.room.code"); check(bool(re.match(r'^[A-Z2-9]{6}$',code)),'A created war room, code %s'%code)
    B.click('text=เข้าร่วมห้องด้วยรหัส'); B.fill('#onlName','จ๊ะเอ๋'); B.click('#onlAvG button >> nth=1'); B.fill('#onlCode',code); B.click('[data-act="join"]'); B.wait_for_timeout(1200)
    check('2/2' in A.inner_text('.onlInfo') and 'ห่าง 1' in B.inner_text('.onlInfo'),'both see 2/2 and host rules (clash=un): B sees "%s"'%B.inner_text('.onlInfo').replace('\n',' | ')[:90])
    # คนที่ 3 เข้าไม่ได้ (ห้องเต็ม)
    C=newpage(b,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'); C.click('text=เข้าร่วมห้องด้วยรหัส'); C.fill('#onlName','นุ'); C.click('#onlAvG button >> nth=2'); C.fill('#onlCode',code); C.click('[data-act="join"]'); C.wait_for_timeout(900)
    check('เต็ม' in C.inner_text('#onl, body') or C.locator('.onlErr, .onlWarn').count()>0 or 'room_full' in C.inner_text('body') or 'เต็ม' in C.evaluate("document.querySelector('#onlToast')?document.querySelector('#onlToast').textContent:''"),'third player rejected: room full')
    C.context.close()
    A.click('[data-act="ready"]'); B.click('[data-act="ready"]'); A.wait_for_timeout(900)
    check(not A.is_disabled('[data-act="start"]'),'host can start when both ready')
    A.click('[data-act="start"]'); A.wait_for_selector('#woHand .wtC',timeout=15000); B.wait_for_selector('#woHand .wtC',timeout=15000)
    check(A.locator('#woHand .wtC').count()==3 and B.locator('#woHand .wtC').count()==3,'both clients have 3-card hands')
    ha=sorted(A.evaluate("HRTAOnline.state.hand.map(c=>c.id)")); hb=sorted(B.evaluate("HRTAOnline.state.hand.map(c=>c.id)"))
    check(not (set(ha)&set(hb)),'hands are disjoint (A %s / B %s)'%(ha,hb))
    # RLS: B ขอมือ/ความลับของ A ตรง ๆ ไม่ได้
    r=B.evaluate("(async()=>{const sb=await HRTAOnline.getClient();const g=HRTAOnline.state.game;const a=await sb.from('player_private_states').select('hand').eq('game_id',g.id);const s=await sb.from('game_secrets').select('*').eq('game_id',g.id);return {rows:a.data.length,secErr:!!s.error}})()")
    check(r['rows']==1 and r['secErr'],'B can read only its own hand row; game_secrets denied')
    # commit–reveal: A เลือกก่อน B เห็นแค่ "เลือกแล้ว" ไม่เห็นว่าเลือกอะไร
    A.locator('#woHand .wtC').nth(2).click(); chosen=A.evaluate("document.querySelector('#woHand .wtC.sel').dataset.v"); A.click('#woAct [data-act="wgo"]'); B.wait_for_timeout(900)
    check('เลือกแล้ว' in B.inner_text('#woOpp') and A.evaluate("HRTAOnline.state.game.public_state.cm")==[True,False] or B.evaluate("HRTAOnline.state.game.public_state.cm")==[True,False],'B sees "chosen" flag for A')
    bp=B.evaluate("JSON.stringify(HRTAOnline.state.game.public_state)"); check(('"c":'+chosen) not in bp and not re.search(r'"hands?"|"deck"|"pend"',bp),'B cannot see which card A chose (public state clean)')
    sec=dump()['game_secrets'][0]['pend']; check(sec[0] is not None and sec[1] is None,'server holds A choice privately in pend')
    # เล่นต่อ (กดพร้อมกันบ่อย ๆ) จนจบ
    done=play_to_end(A,B); check(done,'both screens reached the result')
    if done:
        ra=A.inner_text('.nnRes').replace('\n',' '); rb=B.inner_text('.nnRes').replace('\n',' '); print('A:',ra[:100]);print('B:',rb[:100])
        sa=re.search(r'(\d+) : (\d+)',ra); sb_=re.search(r'(\d+) : (\d+)',rb); check(sa and sb_ and sa.group(0)==sb_.group(0),'both screens show the same final score')
        check(('ชนะ' in ra and 'ชนะ' in rb) or ('เสมอ' in ra and 'เสมอ' in rb),'both results consistent (win/draw)')
        g=dump()['games'][0]; check(g['status']=='finished','server game finished')
        # Rematch
        A.click('[data-act="rematch"]'); A.wait_for_timeout(1200); B.wait_for_timeout(1200)
        check(A.locator('[data-act="ready"]').count()==1 and B.locator('[data-act="ready"]').count()==1,'rematch: both back in lobby')
        A.click('[data-act="ready"]'); B.click('[data-act="ready"]'); A.wait_for_timeout(900); A.click('[data-act="start"]')
        A.wait_for_selector('#woHand .wtC',timeout=15000); B.wait_for_selector('#woHand .wtC',timeout=15000)
        check(A.evaluate("HRTAOnline.state.game.round_no")==2 and B.evaluate("HRTAOnline.state.game.round_no")==2,'second game started on both (round_no=2)')
        # B ออกกลางเกม = ยอมแพ้ → A เห็นผล
        B.evaluate("document.querySelector('[data-act=leave]').click()"); B.wait_for_timeout(800)
        try: B.click('text=ยืนยัน',timeout=1500)
        except Exception: pass
        A.wait_for_selector('.nnRes',timeout=15000); ra=A.inner_text('.nnRes').replace('\n',' '); print('A after B left:',ra[:110])
        check('ยอมแพ้' in ra and 'ชนะ' in ra,'A wins when B leaves mid-game (forfeit)')
    check(len(A.errs)==0 and len(B.errs)==0,'no JS page errors A=%s B=%s'%(A.errs[:1],B.errs[:1]))
    b.close()
finally:
    srv.terminate()
sys.exit(1 if check.bad else 0)
