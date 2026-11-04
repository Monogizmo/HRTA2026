# เล่นเกมเลขเพดานโหมดออฟไลน์ (เล่นกับ AI) ในเบราว์เซอร์: กดเลือกเป้าหมาย / ไพ่ Sun / ข้าม Chariot / แทรก Empress ไปจนจบหลายเกม
# รัน: python3 -m http.server 8765 (ที่โฟลเดอร์โปรเจกต์) แล้ว python3 tests/offline-e2e.test.py
from playwright.sync_api import sync_playwright
import random, sys
random.seed(7)
bad=False
def check(c,m):
    global bad
    print(('ok   ' if c else 'FAIL ')+m)
    if not c: bad=True
with sync_playwright() as p:
    b=p.chromium.launch(); 
    for n in (2,3,4):
        ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); pg=ctx.new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8765/index.html',wait_until='networkidle')
        pg.click('text=เกม'); pg.click('[data-v="nn"]'); pg.wait_for_timeout(300)
        pg.click('#nnB [data-a="n"][data-v="%d"]'%n); pg.click('#nnB [data-a="spd0"][data-v="fast"]') if pg.locator('#nnB [data-a="spd0"][data-v="fast"]').count() else None
        pg.click('#nnB [data-a="go"]'); pg.wait_for_selector('#nnT',timeout=15000)
        seen={'tg':0,'pk':0,'pass':0,'intj':0,'plays':0}
        done=False
        for it in range(2500):
            pg.wait_for_timeout(120)
            if pg.locator('.nnRes').count(): done=True; break
            hdr=pg.locator('#nnHand .nnHdr')
            txt=hdr.inner_text() if hdr.count() else ''
            if pg.locator('#nnHand [data-a="intj"]').count() and random.random()<.7:
                pg.click('#nnHand [data-a="intj"]'); seen['intj']+=1; continue
            if not any(k in txt for k in ('ตาของคุณ','ลงใบที่ 2','ลงเพิ่ม','เลือกไพ่ที่จะเก็บ')): continue
            if pg.locator('#nnHand [data-a="pk"]').count(): pg.click('#nnHand [data-a="pk"]:nth-child(%d)'%random.randint(1,3)); seen['pk']+=1; continue
            if pg.locator('#nnHand [data-a="tg"]').count(): pg.click('#nnHand [data-a="tg"]'); seen['tg']+=1; continue
            if pg.locator('#nnHand [data-a="pass"]').count() and random.random()<.5: pg.click('#nnHand [data-a="pass"]'); seen['pass']+=1; continue
            cards=pg.locator('#nnHand .nnC:not(.dim)')
            if cards.count()==0: continue
            cards.nth(random.randrange(cards.count())).click(); pg.wait_for_timeout(60)
            opts=pg.locator('#nnHand [data-a="opt"]')
            if opts.count(): opts.nth(random.randrange(opts.count())).click(); seen['plays']+=1
        check(done,'n=%d: game reached result screen; actions seen %s'%(n,seen))
        check(len(errs)==0,'n=%d: no JS page errors %s'%(n,errs[:2]))
        ctx.close()
    b.close()
sys.exit(1 if bad else 0)
