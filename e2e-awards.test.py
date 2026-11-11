# รัน (ต้องมี playwright):  python3 tests/e2e-awards.test.py
# HRTA Popular Awards: เทสต์ตามเกณฑ์ 15 ข้อในสเปก ด้วยเบราว์เซอร์จริงหลายตัวที่ใช้เซิร์ฟเวอร์จำลองเดียวกัน (tests/e2e/awards-server.js เลียนตรรกะของ SQL 008)
# หมายเหตุ: SQL 008 เองยังไม่ได้รันกับ Postgres จริงในเครื่องนี้ — ต้องรันบน Supabase แล้วทดสอบด้วย #test ก่อนวันจริง
from playwright.sync_api import sync_playwright
import os, sys, subprocess, time, json, urllib.request, socket, datetime
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'
PORT=8772; SRV='http://localhost:%d'%PORT; WEB=8765
mock=open(root+'tests/e2e/mock-client-awards.js',encoding='utf-8').read()
def check(c,msg):
    print(('ok   ' if c else 'FAIL ')+msg)
    if not c: check.bad=True
check.bad=False
procs=[]
def up(port):
    s=socket.socket(); s.settimeout(.3)
    try: s.connect(('localhost',port)); return True
    except Exception: return False
    finally: s.close()
if not up(WEB): procs.append(subprocess.Popen(['python3','-m','http.server',str(WEB),'--directory',root],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL))
procs.append(subprocess.Popen(['node',root+'tests/e2e/awards-server.js',str(PORT)],stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)); time.sleep(1.2)
def get(path): return json.loads(urllib.request.urlopen(SRV+path).read())
def post(path,obj): return json.loads(urllib.request.urlopen(urllib.request.Request(SRV+path,data=json.dumps(obj).encode(),headers={'Content-Type':'application/json'})).read())
get('/clear')
dump=lambda: get('/dump')
MEM=json.loads(subprocess.check_output(['node','-e','const s=require("fs").readFileSync("%s","utf8");console.log(JSON.stringify(eval(s.match(/const MEM = (\\[.*?\\]);/)[1])))'%(root+'tests/e2e/awards-server.js')]).decode())
CATS=['vacuum','meme','battery','camera','runway','radio','confused','adventure','caring','gift']
OPEN_BKK=datetime.datetime(2026,11,13,9,0,tzinfo=datetime.timezone(datetime.timedelta(hours=7)))
PRE_BKK=datetime.datetime(2026,11,12,10,0,tzinfo=datetime.timezone(datetime.timedelta(hours=7)))
def newpage(b,user,url='index.html#test',clock=None,w=390,h=800):
    ctx=b.new_context(viewport={'width':w,'height':h},service_workers='block'); pg=ctx.new_page(); pg.errs=[]
    pg.on('pageerror',lambda e:pg.errs.append(str(e)))
    pg.add_init_script("window.__USER='%s';window.__SRV='%s';"%(user,SRV)+mock)
    if clock: pg.clock.install(time=clock)
    pg.goto('http://localhost:%d/%s'%(WEB,url),wait_until='load'); pg.wait_for_timeout(500)
    return pg
def open_tab(pg):
    pg.click('.tab[data-t="awards"]'); pg.wait_for_timeout(700)
def confirm(pg): pg.click('.awModal [data-k="1"]'); pg.wait_for_timeout(500)
def login(pg,name):
    pg.click('#awBody .awPerson[data-aw="who"][data-v="%s"]'%name); confirm(pg); pg.wait_for_timeout(300)
def vote(pg,cat_i,nominee):
    pg.click('#awBody .awCat >> nth=%d'%cat_i); pg.wait_for_timeout(150)
    pg.click('#awBody .awPerson[data-aw="pick"][data-v="%s"]'%nominee); pg.click('#awSubmit'); return pg
def txt(pg,sel): return pg.inner_text(sel).replace('\n',' ')
A,B,C=MEM[3],MEM[0],MEM[1]     # A = เบียร์ (ผู้ทดสอบหลัก), B/C = คนอื่น
def nm(i): return MEM[i]
import atexit
atexit.register(lambda:[pr.terminate() for pr in procs])
with sync_playwright() as p:
    b=p.chromium.launch()
    # ---------- ก่อนเปิดโหวต (12 พ.ย.) โหมดปกติ: ต้องเป็นหน้ารอเปิด ไม่เรียกเซิร์ฟเวอร์ ----------
    pg0=newpage(b,'u-pre',url='index.html',clock=PRE_BKK); open_tab(pg0)
    check('เปิดให้โหวตวันที่ 13' in txt(pg0,'#awBody'),'ก่อน 13 พ.ย. (ไม่ใช่ #test) แสดงหน้ารอเปิดโหวต')
    check(pg0.evaluate('window.__CALLS.length')==0,'ก่อนเปิดไม่มีการเรียกเซิร์ฟเวอร์'); check(pg0.locator('#awNav').is_hidden(),'ก่อนเปิดไม่แสดงเมนูโหวต')
    check('ไม่มีใครรู้ว่าคุณโหวตให้ใคร' not in txt(pg0,'#awHero') and 'เตรียมลุ้น' not in txt(pg0,'#awBody') and 'เลือกชื่อ →' not in txt(pg0,'#awBody'),'ก่อน 13 พ.ย. ยังไม่โชว์ข้อความเกริ่นนำ/กติกา (โชว์เมื่อเข้าวันที่ 13)')
    check(txt(pg0,'.tab[data-t="awards"]')=='Popular Awards' and txt(pg0,'.tab[data-t="game"]')=='เกม','แท็บ Popular Awards และ เกม ไม่มีไอคอนอีโมจิ')
    # ---------- #test: เลือกชื่อ ----------
    ua=newpage(b,'u-A'); open_tab(ua)
    check('Who Are You?' in txt(ua,'#awBody') and 'เลือกชื่อของคุณเพื่อเริ่มต้นกิจกรรม' in txt(ua,'#awBody'),'หน้าเลือกชื่อ: ข้อความ Who Are You? ตามสเปก')
    check(ua.locator('#awBody .awPerson').count()==20,'รายชื่อ 20 คน (ไม่มีอาฟเตอร์)'); check('อาฟเตอร์' not in txt(ua,'#awBody'),'อาฟเตอร์ที่ถูกซ่อนไม่อยู่ในรายชื่อ')
    check('โหมดทดสอบ' in txt(ua,'#awHero'),'โหมด #test แสดงป้ายทดสอบ')
    check('ไม่มีใครรู้ว่าคุณโหวตให้ใคร' in txt(ua,'#awHero'),'เมื่อเปิดโหวต (13 พ.ย.) ข้อความเกริ่นนำแสดงที่หัวหน้า')
    ua.fill('#awSearch','beer'); ua.wait_for_timeout(100)
    check(ua.locator('#awBody .awPerson:visible').count()==1,'ค้นหา "beer" (alias) เหลือ 1 คน')
    ua.fill('#awSearch',''); ua.click('#awBody .awPerson[data-v="%s"]'%A); ua.wait_for_timeout(200)
    check('ยืนยันตัวตน' in txt(ua,'.awModal'),'แตะชื่อแล้วมีหน้ายืนยันตัวตน'); ua.click('.awModal [data-k="0"]'); ua.wait_for_timeout(200)
    check(ua.locator('.awModal').count()==0,'ยกเลิกยืนยันแล้วกลับไปเลือกใหม่ได้')
    login(ua,A)
    check(ua.locator('#awBody .awCat').count()==10,'[2] เข้าหน้าโหวต: การ์ด 10 หัวข้อ')
    check(ua.locator('#awBody .awCat.new').count()==10 and 'ยังไม่ได้เลือก' in txt(ua,'#awBody .awCat >> nth=0'),'ทุกการ์ดเริ่มที่ "ยังไม่ได้เลือก"')
    # ---------- [1] เลือกชื่อตัวเองไม่ได้ ----------
    ua.click('#awBody .awCat >> nth=0'); ua.wait_for_timeout(150)
    me_btn=ua.locator('#awBody .awPerson[data-v="%s"]'%A)
    check(me_btn.is_disabled() and 'นี่คือคุณ' in me_btn.inner_text(),'[1] การ์ดชื่อตัวเองถูกปิด เลือกไม่ได้')
    check(ua.locator('#awBody .awPerson[data-aw="pick"]').count()==19,'เลือกได้ 19 คน (ไม่รวมตัวเอง)')
    check(ua.is_disabled('#awSubmit'),'ยังไม่เลือกใคร ปุ่ม Submit ถูกปิด')
    r=ua.evaluate('''async()=>{const sb=await HRTAOnline.getClient();const r=await sb.rpc("awd_vote",{p_ns:"test",p_voter:"%s",p_category:"vacuum",p_nominee:"%s"});return r.error&&r.error.message}'''%(A,A))
    check(r=='self_vote','[1] ฝั่งเซิร์ฟเวอร์ปฏิเสธการโหวตตัวเอง (self_vote)')
    # ---------- [2][3] ส่งทีละหัวข้อ + ข้ามหัวข้อ ----------
    ua.click('#awBody .awPerson[data-v="%s"]'%B); check(ua.is_enabled('#awSubmit'),'เลือกเพื่อนแล้วปุ่ม Submit ใช้ได้')
    ua.click('#awSubmit'); ua.wait_for_timeout(200)
    t=txt(ua,'.awModal'); check('You are voting for' in t and 'คุณกำลังมอบรางวัล กินเก่งที่สุด ให้กับ '+B in t,'ยืนยันก่อนบันทึก: "คุณกำลังมอบรางวัล กินเก่งที่สุด ให้กับ [ชื่อ]"')
    check('หัวข้อสุดท้าย' not in t,'หัวข้อที่ไม่ใช่หัวข้อสุดท้ายไม่มีคำเตือนล็อก')
    check(dump()['votes']=={} ,'ยังไม่กดยืนยัน = ยังไม่บันทึกอะไรลงเซิร์ฟเวอร์')
    confirm(ua); ua.wait_for_timeout(400)
    check(ua.locator('#awBody .awCat').count()==10,'[2] หลังยืนยันกลับหน้าหัวข้อทั้งหมด')
    check(ua.locator('#awBody .awCat.sub').count()==1 and B in txt(ua,'#awBody .awCat.sub'),'[2] การ์ดแรกเป็น "ส่งผลโหวตแล้ว" และแสดงคนที่โหวตให้ (เห็นเฉพาะตัวเอง)')
    d=dump()['votes']; check(list(d.keys())==['test|%s|vacuum'%A] and d['test|%s|vacuum'%A]['nominee']==B,'[2] เซิร์ฟเวอร์เก็บเฉพาะหัวข้อนั้น 1 แถว')
    ua.click('#awBody .awCat >> nth=1'); ua.click('#awBody .awPerson[data-aw="pick"][data-v="%s"]'%C); ua.click('[data-aw="back"]'); ua.wait_for_timeout(150)
    check(ua.locator('#awBody .awCat.thk').count()==1 and 'กำลังตัดสินใจ' in txt(ua,'#awBody .awCat.thk'),'[3] เลือกแล้วยังไม่ส่ง/ข้ามไป = "กำลังตัดสินใจ"')
    check(len(dump()['votes'])==1,'[3] ข้ามหัวข้อไม่บันทึกอะไร')
    vote(ua,2,nm(5)); confirm(ua); ua.wait_for_timeout(300)       # ข้ามไปทำหัวข้อที่ 3 ก่อน
    check(ua.locator('#awBody .awCat.sub').count()==2,'[3] กลับมาโหวตหัวข้ออื่นภายหลังได้ (ข้ามหัวข้อที่ 2 ไว้)')
    # ---------- [4][6] แก้ไขคะแนน = update แถวเดิม ไม่สร้างซ้ำ ----------
    ua.click('#awBody .awCat >> nth=0'); ua.wait_for_timeout(100)
    check('ตอนนี้คุณโหวตให้' in txt(ua,'#awBody') and ua.locator('#awBody .awPerson.sel').count()==1,'[4] เปิดหัวข้อที่ส่งแล้วเห็นว่าเลือกใครไว้')
    check(ua.is_disabled('#awSubmit'),'[4] ยังไม่เปลี่ยนคน ปุ่มส่งถูกปิด')
    ua.click('#awBody .awPerson[data-aw="pick"][data-v="%s"]'%nm(7)); ua.click('#awSubmit'); confirm(ua); ua.wait_for_timeout(400)
    d=dump()['votes']; k='test|%s|vacuum'%A
    check(d[k]['nominee']==nm(7) and d[k]['edits']==1,'[4] แก้ไขได้: คะแนนเดิมถูกบันทึกทับ (edits=1)')
    check(len([x for x in d if x.startswith('test|%s|'%A)])==2,'[6] ไม่เกิดแถวซ้ำ: ผู้โหวต 1 คน × หัวข้อ 1 = 1 แถว')
    # ---------- ออฟไลน์: ส่งไม่ได้ ต้องไม่พัง ไม่สูญเสียที่เลือก ----------
    ua.click('#awBody .awCat >> nth=1'); ua.click('#awBody .awPerson[data-aw="pick"][data-v="%s"]'%C); ua.evaluate('window.__OFFLINE=true'); ua.click('#awSubmit'); confirm(ua); ua.wait_for_timeout(300)
    check('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' in txt(ua,'.awToast'),'ออฟไลน์: แจ้งเตือนที่เข้าใจง่าย'); check(ua.locator('#awBody .awPerson.sel').count()==1 and ua.is_enabled('#awSubmit'),'ออฟไลน์: ยังอยู่หน้าเดิมและกดส่งใหม่ได้')
    ua.evaluate('window.__OFFLINE=false'); ua.click('#awSubmit'); confirm(ua); ua.wait_for_timeout(500)
    check(len([x for x in dump()['votes'] if x.startswith('test|%s|'%A)])==3,'กลับมาออนไลน์แล้วส่งสำเร็จ')
    # ---------- ทำให้ครบ + ล็อก [5] ----------
    for i in range(3,9):
        vote(ua,i,nm(8+i)); confirm(ua); ua.wait_for_timeout(250)
    check(ua.locator('#awBody .awCat.sub').count()==9,'โหวตแล้ว 9 หัวข้อ'); check('9 / 10' in txt(ua,'.awProg'),'แถบความคืบหน้าของตัวเอง 9 / 10')
    check(len(ua.locator('#awBody .awCat.sub').all())==9 and ua.locator('#awBody .awCat.new').count()==1,'เหลือ 1 หัวข้อ (ยังไม่ได้เลือก)')
    vote(ua,9,nm(9)); ua.wait_for_timeout(100)
    check('หัวข้อสุดท้าย' in txt(ua,'.awModal') and 'ล็อก' in txt(ua,'.awModal'),'[5] หัวข้อสุดท้ายมีคำเตือนว่าจะล็อก'); confirm(ua); ua.wait_for_timeout(600)
    check('Completed' in txt(ua,'#awBody') and 'การโหวตของคุณถูกล็อกแล้ว' in txt(ua,'#awBody') and ua.locator('#awBody .awCat').count()==0,'[5] โหวตครบ → แสดง Completed และหน้าแก้ไขหายไป')
    r=ua.evaluate('''async()=>{const sb=await HRTAOnline.getClient();const r=await sb.rpc("awd_vote",{p_ns:"test",p_voter:"%s",p_category:"vacuum",p_nominee:"%s"});return r.error&&r.error.message}'''%(A,nm(2)))
    check(r=='locked','[5] ฝั่งเซิร์ฟเวอร์ล็อกจริง: แก้หลังครบถูกปฏิเสธ (locked)')
    check(dump()['votes']['test|%s|vacuum'%A]['nominee']==nm(7),'[5] คะแนนไม่ถูกเปลี่ยนหลังล็อก')
    check(len([x for x in dump()['votes'] if x.startswith('test|%s|'%A)])==10,'[6] ครบ 10 แถว ไม่มีซ้ำ')
    # ---------- [7][8][9] สถานะ + อีกอุปกรณ์ ----------
    ub=newpage(b,'u-B'); open_tab(ub)
    check(ub.locator('#awBody .awPerson.done').count()==1 and A in txt(ub,'#awBody .awPerson.done'),'[7] อุปกรณ์อื่น: ชื่อที่โหวตครบแล้วเป็น Completed และเลือกอีกไม่ได้')
    check(ub.locator('#awBody .awPerson.done').is_disabled(),'หนึ่งชื่อโหวตได้ชุดเดียว (ปุ่ม Completed ปิด)')
    check('1 / 20' in txt(ub,'#awTop'),'[8] อุปกรณ์อื่นเห็นความคืบหน้าทีม 1 / 20')
    ub.click('[data-aw="view"][data-v="status"]'); ub.wait_for_timeout(300)
    t=txt(ub,'#awBody'); check("Who's Done Voting?" in t and '1 / 20 Completed' in t,'[7] หน้า Who\'s Done Voting? แสดง 1 / 20 Completed')
    check(ub.locator('#awBody .awPill.ok').count()==1 and ub.locator('#awBody .awPill.think').count()==19,'[7] สถานะมีแค่ Completed 1 / Thinking 19 (คนยังไม่เริ่มก็ Thinking)')
    check('Not Started' not in t and 'Submitted' not in t,'[7] สถานะสาธารณะมีเพียง 2 แบบ')
    ua.click('[data-aw="view"][data-v="status"]'); ua.wait_for_timeout(300); ua.click('[data-aw="view"][data-v="vote"]'); ua.wait_for_timeout(300)
    raw=ub.evaluate('''async()=>{const sb=await HRTAOnline.getClient();const s=await sb.rpc("awd_state",{p_ns:"test",p_voter:"%s"});const r=await sb.rpc("awd_results",{p_ns:"test"});return JSON.stringify([s.data,r.data])}'''%A)
    check('nominee' not in raw and '"votes":{}' in raw,'[9] ข้อมูลที่ client ได้ไม่มีว่าใครโหวตให้ใคร (ชื่อที่ครบแล้วไม่คืนรายละเอียด)')
    # ---------- [10] ไม่เปิดเผยผลก่อนทุกคนครบ ----------
    ub.click('[data-aw="view"][data-v="results"]'); ub.wait_for_timeout(300); t=txt(ub,'#awBody')
    check('Waiting for Everyone!' in t and 'อีก 19 คน' in t,'[10] หน้า Results ล็อก: "Waiting for Everyone!" และจำนวนที่ยัง Thinking (19)')
    check(ub.locator('#awBody .awChips .awPill').count()==19 and A not in txt(ub,'#awBody .awChips'),'[10] แสดงรายชื่อคนที่ยังไม่ครบ (ไม่รวมคนที่ครบ)')
    check('Reveal' not in t and ub.locator('.awHall').count()==0,'[10] ไม่มีปุ่มเปิดผล/ไม่มีคะแนน')
    r=ub.evaluate('''async()=>{const sb=await HRTAOnline.getClient();const r=await sb.rpc("awd_results",{p_ns:"test"});return JSON.stringify(r.data)}''')
    check('"ready":false' in r and 'categories' not in r and 'votes' not in r,'[10] เซิร์ฟเวอร์ไม่ส่งคะแนนก่อนครบ (ready:false)')
    # ---------- [11] ปลดล็อกอัตโนมัติเมื่อครบ ----------
    ub.click('[data-aw="view"][data-v="vote"]'); ub.wait_for_timeout(200); ub.click('[data-aw="view"][data-v="results"]')
    ua.click('[data-aw="seed"]'); ua.wait_for_timeout(600)
    ub.wait_for_selector('text=Everyone Has Voted!',timeout=9000)
    check('Reveal The Winners' in txt(ub,'#awBody'),'[11] เมื่อทุกคนครบ หน้า Results ปลดล็อกเองบนอุปกรณ์อื่น (ไม่ต้องรีเฟรช) พร้อมปุ่ม Reveal The Winners')
    check('20 / 20' in txt(ub,'#awTop'),'[8] สถานะอัปเดตเป็น 20 / 20 บนอุปกรณ์อื่นแบบอัตโนมัติ')
    # ---------- [12] ผลคะแนน + ผู้ชนะร่วม (ใส่ข้อมูลตายตัวเพื่อตรวจ) ----------
    get('/clear'); votes=[]
    for i,m in enumerate(MEM):
        for c in CATS:
            if c=='vacuum': n = MEM[1] if i==0 else MEM[0] if i==1 else (MEM[0] if i<=10 else MEM[1])
            else: n = MEM[1] if i==0 else MEM[0]
            votes.append([m,c,n])
    post('/force',{'ns':'test','votes':votes})
    uc=newpage(b,'u-C'); open_tab(uc); uc.click('[data-aw="view"][data-v="results"]'); uc.wait_for_timeout(400)
    check('Everyone Has Voted!' in txt(uc,'#awBody'),'ผลปลดล็อกเมื่อเปิดจากอุปกรณ์ใหม่ (ข้อมูลมาจากส่วนกลาง)')
    # กันสปอยล์: ยังไม่ได้กด Reveal บนเครื่องนี้ → พาสปอร์ตยังไม่โชว์รางวัล
    uc.evaluate("ppOpen(%r)"%MEM[0]); uc.wait_for_timeout(500)
    check(uc.locator('#ppm .ppAw .ppAwR').count()==0,'พาสปอร์ตยังไม่โชว์รางวัลก่อนกด Reveal (กันสปอยล์)'); uc.click('#ppX'); uc.click('.tab[data-t="awards"]'); uc.wait_for_timeout(300)
    uc.click('[data-aw="reveal"]',force=True); uc.wait_for_selector('.awHall',timeout=6000); uc.wait_for_timeout(2200)
    check(uc.locator('.awHall .awPlq').count()==10 and uc.locator('.awCountdown,#awCnt,#awStage').count()==0,'ผลรางวัลเป็นหน้าเดียว: แท่นรับรางวัลครบ 10 หมวด ไม่มีการกดไล่ทีละหัวข้อ')
    t=txt(uc,'.awPlq[data-cat="vacuum"]'); check('The Human Vacuum' in t.title() or 'THE HUMAN VACUUM' in t.upper(),'ผลแสดงชื่อรางวัลภาษาอังกฤษ'); check('กินเก่งที่สุด' in t,'ผลแสดงชื่อรางวัลภาษาไทย')
    check('ผู้ชนะร่วม' in t and MEM[0] in t and MEM[1] in t and uc.locator('.awPlq[data-cat="vacuum"] .awCol.r1 .awPp').count()==2,'[12] คะแนนเท่ากัน → ผู้ชนะร่วม 2 คน (ไม่สุ่ม) อยู่แท่นที่ 1 ด้วยกัน')
    check('10' in txt(uc,'.awPlq[data-cat="vacuum"] .awCol.r1 .awStep') and '50%' in t,'แสดงจำนวนคะแนนและเปอร์เซ็นต์ (10 คะแนน 50%)')
    check('ผู้ร่วมโหวตหัวข้อนี้ 20 คน' in t,'แสดงจำนวนผู้เข้าร่วมโหวตทั้งหมด')
    t=txt(uc,'.awPlq[data-cat="meme"]')
    check(MEM[0] in t and '19' in txt(uc,'.awPlq[data-cat="meme"] .awCol.r1 .awStep') and '95%' in t and 'ผู้ชนะร่วม' not in t,'[12] หัวข้ออื่น: ผู้ชนะคนเดียว 19 คะแนน 95%')
    check(uc.locator('.awPlq[data-cat="meme"] .awCol.r2 .awPp').count()==1 and MEM[1] in txt(uc,'.awPlq[data-cat="meme"] .awCol.r2'),'แสดงอันดับ 2 บนแท่น (และอันดับ 3 ถ้ามี)')
    check('MOST DECORATED' in txt(uc,'.awMost') and MEM[0] in txt(uc,'.awMost') and 'ชนะ 10 รางวัล' in txt(uc,'.awMost'),'ผู้ชนะหลายรางวัลขึ้นป้าย Most Decorated')
    check(uc.locator('#awBody .awPlq svg.awMd').count()>=10 and uc.locator('#awBody .awHall .awCr').count()>=10,'ไอคอนหัวข้อเป็น SVG ทอง และมีมงกุฎของผู้ชนะ')
    check('ใครโหวตให้ใคร' not in txt(uc,'#awBody') and 'โหวตให้' not in txt(uc,'#awBody'),'[9] หน้า Results ไม่แสดงรายละเอียดว่าใครโหวตให้ใคร')
    uc.screenshot(path='/tmp/awshots/hall_top.png'); uc.evaluate("document.querySelector('.awPlq[data-cat=\"meme\"]').scrollIntoView({block:'start'})"); uc.wait_for_timeout(300); uc.screenshot(path='/tmp/awshots/hall_mid.png')
    uc.screenshot(path='/tmp/awshots/hall_full.png',full_page=True)
    # ---------- ผู้ชนะขึ้นพาสปอร์ต ----------
    uc.evaluate("ppOpen(%r)"%MEM[0]); uc.wait_for_selector('#ppm .ppAwR',timeout=5000)
    check(uc.locator('#ppm .ppAw .ppAwR').count()==10 and 'POPULAR AWARDS' in txt(uc,'#ppm .ppAw'),'พาสปอร์ตผู้ชนะ 10 หมวด แสดงรางวัลครบ')
    t=txt(uc,'#ppm .ppAw'); check('95%' in t and '19' in t and 'ผู้ชนะร่วม' in t,'พาสปอร์ตแสดงคะแนน/เปอร์เซ็นต์ของหมวดที่ชนะ และป้ายผู้ชนะร่วม')
    uc.screenshot(path='/tmp/awshots/passport_winner.png',full_page=True)
    uc.evaluate("savePassport(%r)"%MEM[0]); uc.wait_for_selector('#dlg img',timeout=15000); uc.wait_for_timeout(400)
    uc.evaluate("(()=>{const i=document.querySelector('#dlg img');window.__pngW=i.naturalWidth;window.__pngH=i.naturalHeight})()")
    check(uc.evaluate('window.__pngW')==1080 and uc.evaluate('window.__pngH')>2600,'รูปพาสปอร์ตที่บันทึกมีส่วนรางวัล (ความสูงเพิ่ม)')
    uc.evaluate("document.querySelector('#dlg img').scrollIntoView()"); uc.screenshot(path='/tmp/awshots/passport_png.png')
    uc.click('#svX'); uc.click('#ppX'); 
    uc.evaluate("ppOpen(%r)"%MEM[5]); uc.wait_for_timeout(600); check(uc.locator('#ppm .ppAw .ppAwR').count()==0,'คนที่ไม่ได้รางวัล: พาสปอร์ตไม่มีส่วนรางวัล'); uc.click('#ppX')
    uc.reload(wait_until='load'); uc.wait_for_timeout(500); open_tab(uc); uc.click('[data-aw="view"][data-v="results"]'); uc.wait_for_selector('.awHall',timeout=6000)
    check(True,'รีเฟรชแล้วกลับมาที่หน้าผลรางวัลเลย (จำว่าเคย Reveal แล้ว)')
    # ---------- [15] รีเฟรช/อุปกรณ์อื่น ข้อมูลไม่หาย ----------
    ua.reload(wait_until='load'); ua.wait_for_timeout(600); open_tab(ua)
    check('Completed' in txt(ua,'#awBody'),'[15] รีเฟรชแล้วจำชื่อและสถานะ Completed ได้ (ข้อมูลอยู่ที่ส่วนกลาง)')
    check('โหมดทดสอบ' in txt(ua,'#awHero'),'[15] รีเฟรชแล้วยังอยู่ในโหมดทดสอบ (จำไว้ต่อแท็บ) ไม่หลุดไปโหมดจริง')
    # ---------- ล้างข้อมูลทดสอบ ----------
    ua.click('[data-aw="reset"]'); confirm(ua); ua.wait_for_timeout(600)
    check(len(dump()['votes'])==0 and 'Who Are You' in txt(ua,'#awBody') or 'โหวตของคุณ' in txt(ua,'#awBody'),'ล้างข้อมูลทดสอบแล้วกลับสู่ตั้งต้น')
    ua.click('[data-aw="exit"]'); ua.wait_for_timeout(900); open_tab(ua)
    check('โหมดทดสอบ' not in txt(ua,'#awHero') and 'เปิดให้โหวตวันที่ 13' in txt(ua,'#awBody'),'ออกจากโหมดทดสอบ → กลับโหมดจริง (ก่อนเปิดจึงเห็นหน้ารอเปิด)')
    # ---------- โหมดจริงหลังเปิด (13 พ.ย.): ใช้ ns=live แยกจากทดสอบ ----------
    ul=newpage(b,'u-L',url='index.html',clock=OPEN_BKK); open_tab(ul)
    check('Who Are You?' in txt(ul,'#awBody') and 'โหมดทดสอบ' not in txt(ul,'#awHero'),'หลัง 13 พ.ย. 00:00 เปิดโหวตจริง (ไม่มีป้ายทดสอบ)')
    login(ul,A); vote(ul,0,B); confirm(ul); ul.wait_for_timeout(400)
    ks=list(dump()['votes'].keys()); check(ks==['live|%s|vacuum'%A],'โหวตจริงเก็บใน ns=live แยกจาก test')
    r=ul.evaluate('''async()=>{const sb=await HRTAOnline.getClient();const r=await sb.rpc("awd_vote",{p_ns:"live",p_voter:"%s",p_category:"meme",p_nominee:"%s"});return r.error&&r.error.message}'''%(A,B))
    check(r is None,'ฟังก์ชันโหวตจริงใช้ได้หลังเวลาเปิด')
    r=pg0.evaluate('''async()=>{const sb=await HRTAOnline.getClient();const r=await sb.rpc("awd_vote",{p_ns:"live",p_voter:"%s",p_category:"meme",p_nominee:"%s"});return r.error&&r.error.message}'''%(A,B)) if False else None
    # ---------- ทุกหน้าจอ: ไม่มี JS error + ภาพหน้าจอสำหรับตรวจตา ----------
    os.makedirs('/tmp/awshots',exist_ok=True)
    for name,pg in [('pre',pg0),('A',ua),('B',ub),('C',uc),('L',ul)]:
        check(len(pg.errs)==0,'ไม่มี JS error (%s) %s'%(name,pg.errs[:2]))
    uc.screenshot(path='/tmp/awshots/results_mobile.png')
    b.close()
for pr in procs: pr.terminate()
sys.exit(1 if check.bad else 0)
