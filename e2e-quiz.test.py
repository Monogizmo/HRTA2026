# รัน (ต้องมี playwright; http server ที่โฟลเดอร์โปรเจกต์ พอร์ต 8765):  python3 tests/e2e-quiz.test.py
# Quiz leaderboard: ส่งคะแนน/เล่นกี่ครั้ง/อันดับทั้งทีม + อันดับเครื่องนี้ + ออฟไลน์แล้วส่งย้อนหลัง (ใช้ตัวจำลองที่เลียน SQL ใน 007)
from playwright.sync_api import sync_playwright
import os, sys, json
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'
mock=open(root+'tests/e2e/mock-supabase-quiz.js',encoding='utf-8').read()
def check(c,msg):
    print(('ok   ' if c else 'FAIL ')+msg)
    if not c: check.bad=True
check.bad=False
def play(pg,name):
    pg.select_option('#qzName',name); pg.click('#qzGo')
    for i in range(20):
        pg.click('.qo >> nth=0'); pg.click('#qzNx')
    pg.wait_for_selector('#qzAgain',timeout=10000)
    return int(pg.inner_text('.hero2 div').split('/')[0])
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(mock)
    pg.goto('http://localhost:8765/index.html',wait_until='networkidle')
    pg.click('.tab[data-t="quiz"]'); pg.wait_for_timeout(500)
    check('คนแรก' in pg.inner_text('#qlbBody'),'empty team leaderboard invites first player')
    s1=play(pg,'เบสท์'); pg.wait_for_timeout(600)
    check('ส่งขึ้นอันดับทีมแล้ว' in pg.inner_text('#qzSave'),'score submitted to team leaderboard (save text)')
    t=pg.inner_text('#qlbBody'); check('เบสท์' in t and 'ผู้เล่น 1 คน' in t and 'เล่นรวม 1 ครั้ง' in t,'leaderboard shows 1 player / 1 play: '+t.replace('\n',' ')[:110])
    pg.click('#qzAgain'); s2=play(pg,'เบสท์'); pg.wait_for_timeout(600)
    db=pg.evaluate('window.__QDB'); r=db['เบสท์']
    check(r['plays']==2 and r['best']==max(s1,s2),'server counted 2 plays, best=max (%d,%d → %d)'%(s1,s2,r['best']))
    row=pg.locator('#qlbBody tbody tr').first.inner_text().replace('\n',' ').replace('\t',' '); check(('%d/20'%max(s1,s2)) in row and ' 2' in row,'row shows best + plays: '+row)
    pg.click('#qzAgain'); play(pg,'เบียร์'); pg.wait_for_timeout(600)
    t=pg.inner_text('#qlbBody'); check('ผู้เล่น 2 คน' in t and 'เล่นรวม 3 ครั้ง' in t,'2 players / 3 plays total')
    bests=pg.evaluate("[...document.querySelectorAll('#qlbBody tbody tr td:nth-child(3) b')].map(e=>+e.textContent)")
    check(bests==sorted(bests,reverse=True),'ranked by best score desc: %s'%bests)
    check(pg.locator('#qlbBody tbody tr.me').count()==1,'current player row highlighted')
    pg.click('.qlbTabs button[data-m="local"]'); pg.wait_for_timeout(200)
    check('เฉพาะเครื่องนี้' in pg.inner_text('#qlbBody') and pg.locator('#qlbBody tbody tr').count()==2,'local tab lists 2 players from this device')
    pg.click('.qlbTabs button[data-m="team"]'); pg.wait_for_timeout(400)
    # ออฟไลน์: ส่งไม่ได้ → ค้างคิว → ออนไลน์แล้วรีเฟรชต้องส่งย้อนหลัง
    pg.click('#qzAgain'); pg.evaluate('window.__QFAIL=true'); play(pg,'นุ'); pg.wait_for_timeout(600)
    check('ยังส่งอันดับทีมไม่ได้' in pg.inner_text('#qzSave'),'offline: tells user team submit is pending')
    pend=json.loads(pg.evaluate("localStorage.getItem('hrta-quiz-pending')")); check(len(pend)==1 and pend[0]['n']=='นุ','offline: score queued in localStorage')
    check('นุ' not in (pg.evaluate('Object.keys(window.__QDB)')),'offline: nothing reached server yet')
    check('ดึงอันดับทีมไม่ได้' in pg.inner_text('#qlbBody'),'offline: friendly error shown (no crash)')
    pg.evaluate('window.__QFAIL=false'); pg.click('#qlbRef'); pg.wait_for_timeout(700)
    check('นุ' in pg.evaluate('Object.keys(window.__QDB)') and json.loads(pg.evaluate("localStorage.getItem('hrta-quiz-pending')"))==[],'back online: queued score flushed, queue empty')
    check('ผู้เล่น 3 คน' in pg.inner_text('#qlbBody'),'leaderboard now has 3 players')
    # รีเฟรชหน้า: คิว/คะแนนในเครื่องยังอยู่ และอันดับทีมโหลดได้
    pg.reload(wait_until='networkidle'); pg.click('.tab[data-t="quiz"]'); pg.wait_for_timeout(600)
    # (ตัวจำลองเป็นหน่วยความจำของหน้า จึงรีเซ็ตเมื่อรีเฟรช — ตรวจว่าข้อมูลในเครื่องยังอยู่ และอันดับทีมโหลดซ้ำได้ไม่พัง)
    check('คนแรก' in pg.inner_text('#qlbBody') or 'ผู้เล่น' in pg.inner_text('#qlbBody'),'after reload team leaderboard loads again without error')
    pg.click('.qlbTabs button[data-m="local"]'); pg.wait_for_timeout(200)
    check(pg.locator('#qlbBody tbody tr').count()==3,'after reload local leaderboard still has 3 players (persisted)')
    check(len(errs)==0,'no JS page errors '+str(errs[:2]))
    b.close()
sys.exit(1 if check.bad else 0)
