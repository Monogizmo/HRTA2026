# รัน (ต้องมี playwright; เปิด http server ที่โฟลเดอร์โปรเจกต์ พอร์ต 8765):  python3 tests/e2e-war-offline.test.py
# สงครามไพ่ออฟไลน์ใน Chromium: โหมดวัดดวงเดิมยังเล่นจบ + หน้าเลือกโหมด + ยุทธวิธีกับโคลนเล่นจนจบ + สถิติ/เหรียญหลังรีเฟรช
from playwright.sync_api import sync_playwright
import sys, re
def check(c,msg):
    print(('ok   ' if c else 'FAIL ')+msg)
    if not c: check.bad=True
check.bad=False
def coins(pg): return pg.evaluate("(()=>{const k=Object.keys(localStorage).find(k=>{try{return JSON.parse(localStorage.getItem(k)).wr}catch(e){return false}});return k?JSON.parse(localStorage.getItem(k)):null})()")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html',wait_until='networkidle')
    pg.click('text=เกม'); pg.click('[data-v="war"]'); pg.wait_for_timeout(400)
    check(pg.is_visible('#wrSet') and not pg.is_visible('#wtSet') and pg.is_visible('#wtModes'),'mode chooser shown; luck mode is default')
    lab=pg.inner_text('#wrOMode'); check('เพื่อนเครื่องเดียวกัน' in lab and 'เล่นกับโคลน (น้องเบสท์)' in lab,'luck opponent labels renamed')
    # ---- โหมดวัดดวง: เล่นกับโคลนจนจบ ----
    pg.click('#wrOMode [data-v="dealer"]'); pg.click('#wrGo'); pg.wait_for_timeout(1500)
    import time; done=False; t0=time.time()
    while time.time()-t0<200:
        if pg.evaluate("!document.getElementById('wrEnd').hidden"): done=True; break
        if pg.evaluate("(()=>{const d=document.getElementById('wrDk0');return !!d&&!d.className.includes('empty')&&!d.disabled})()"):
            pg.evaluate("document.getElementById('wrDk0').click()")
        pg.wait_for_timeout(250)
    check(done,'luck mode (original rules) played to the end vs dealer')
    if done: pg.screenshot(path='/tmp/luck_end.png')
    # ---- สลับไปยุทธวิธี ----
    if pg.is_visible('#wrEnd'):
        try: pg.click('#wrEnd button', timeout=2000)
        except Exception: pass
    pg.reload(wait_until='networkidle'); pg.click('text=เกม'); pg.click('[data-v="war"]'); pg.wait_for_timeout(300)
    pg.click('#wtModes [data-g="tac"]'); pg.wait_for_timeout(300)
    check(pg.is_visible('#wtSet') and not pg.is_visible('#wrSet'),'switch to tactics shows tactics setup, hides luck setup')
    check(pg.locator('#wtOPw').count()==0,'no special-power toggle anywhere')
    before=coins(pg)
    pg.click('#wtStart'); pg.wait_for_selector('#wtHand .wtC',timeout=15000)
    check(pg.locator('#wtHand .wtC').count()==3,'tactics: 3-card hand')
    over=False; wars=0
    for i in range(300):
        if pg.is_visible('#wtEnd'): over=True; break
        try: pg.wait_for_selector('#wtHand .wtC',timeout=15000)
        except Exception: break
        cards=pg.locator('#wtHand .wtC'); n=cards.count()
        if pg.is_visible('#wtRt'):
            wars+=1; need=3 if n>=4 else max(0,n-1)
            for k in range(need): cards.nth(k).click()
            cards.nth(n-1).click()
        else:
            cards.nth(n-1).click()
            if pg.is_visible('#wtRz') and i%4==1: pg.click('#wtRz'); cards.nth(0).click()
        pg.click('#wtGo'); pg.wait_for_timeout(120)
    pg.wait_for_selector('#wtEnd:not([hidden])',timeout=60000)
    txt=pg.inner_text('#wtEnd'); check(re.search(r'\d+ : \d+',txt) is not None,'tactics: result screen with score')
    st=coins(pg); t=st['wr'].get('tac',{}).get('sm',{}); played=t.get('w',0)+t.get('l',0)+t.get('d',0)
    check(played==1,'tactics: stats recorded (ST.wr.tac.sm = %s)'%t)
    # ---- รีเฟรชแล้วสถิติ/โหมด/เหรียญไม่หาย ----
    c0=st.get('coins',st.get('coin'))
    pg.reload(wait_until='networkidle'); pg.click('text=เกม'); pg.click('[data-v="war"]'); pg.wait_for_timeout(300)
    st2=coins(pg); t2=st2['wr'].get('tac',{}).get('sm',{})
    check(t2==t,'after reload tactics stats persisted'); check(pg.evaluate('document.getElementById("wrB").dataset.gm')=='tac','after reload last mode remembered')
    check(st2.get('coins',st2.get('coin'))==c0,'after reload coins persisted')
    check(len(errs)==0,'no JS page errors '+str(errs[:2]))
    b.close()
sys.exit(1 if check.bad else 0)
