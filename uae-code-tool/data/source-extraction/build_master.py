import json,sys,os
raw=json.load(open(sys.argv[1]))
OUT=sys.argv[2]
PILLARS={
 "1":("تجربة أبسط.. أسهل.. أسرع","تقديم خدمات حكومية مبسطة وسلسة يسهل الوصول إليها واستخدامها من قبل جميع فئات المتعاملين، ورقمنتها مع إزالة التعقيدات وضمان إنجازها بسرعة وكفاءة."),
 "2":("المتعامل أولاً","وضع المتعامل في صلب الأولويات عند تصميم وتطوير الخدمات من خلال الاستماع المستمر لصوته والاستجابة الفعالة لاحتياجاته وتوقعاته."),
 "3":("أنسنة الخدمات","تصميم خدمات تتناسب مع تصنيف المتعامل واحتياجاته في مختلف الأحداث الحياتية، مع تقديم خدمات استباقية ومخصصة بناءً على موافقته المسبقة."),
 "4":("اتساق التجربة عبر مختلف قنوات الخدمة","تمكين المتعامل من الحصول على تجربة متسقة وسلسة عبر جميع قنوات الخدمة، مع حرية الانتقال بينها دون انقطاع أو إعادة المراحل."),
 "5":("أنظمة رقمية مرنة وآمنة","بناء منظومة رقمية آمنة ومتكاملة تضمن حماية بيانات المتعاملين وخصوصيتهم، وتمكن الأنظمة من التواصل بأمان وكفاءة، مع الحفاظ على الشفافية والمساءلة."),
 "6":("ثقافة الخدمة المتميزة","تمكين الموظفين بالمعرفة والأدوات والصلاحيات اللازمة لتقديم خدمة حكومية متميزة تضع احتياجات المتعامل في الأولوية."),
 "7":("التصميم التشاركي","إشراك المتعاملين والشركاء وقطاع الأعمال بشكل مستمر وفعال في تصميم وتطوير الخدمات، مع الاستجابة الشفافة لملاحظاتهم وتوثيق أثرها."),
 "8":("كفاءة الخدمة والأنظمة","ضمان استمرارية الخدمات وموثوقيتها في جميع الظروف من خلال بنية تقنية مرنة وخطط استباقية للتعافي السريع، مع التواصل الشفاف والمستمر مع المتعاملين."),
}
def key(cid):
    base=cid.rstrip('b'); a=[int(x) for x in base.split('.')]; return a+[1 if cid.endswith('b') else 0]
pillars=[dict(id=k,name_ar=v[0],desc_ar=v[1]) for k,v in PILLARS.items()]
subs=[dict(id=k,pillar=k.split('.')[0],name_ar=v) for k,v in sorted(raw['subpillars'].items(),key=lambda kv:key(kv[0]))]
codes=[]
for c in sorted(raw['codes'],key=lambda c:key(c['id'])):
    flags=[]
    if c.get('id_note'): flags.append('duplicate_id_in_pdf')
    if not c['impact']: flags.append('impact_not_specified_in_pdf')
    codes.append(dict(id=c['id'],pdf_id=c['pdf_id'],sub=c['sub'],pillar=c['pillar'],impact=c['impact'],
        desc_ar=c['desc'],
        requirements=[dict(n=i+1,text_ar=t) for i,t in enumerate(c['req'])],
        criteria=[dict(n=i+1,text_ar=t) for i,t in enumerate(c['crit'])],
        pdf_page=c['pdf_page'],flags=flags))
master=dict(source="كود الإمارات للخدمات الحكومية وتصفير البيروقراطية — وزارة شؤون مجلس الوزراء، مكتب رئاسة مجلس الوزراء",
            extracted="2026-11-03",pillars=pillars,subpillars=subs,codes=codes)
json.dump(master,open(OUT,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
os.makedirs(os.path.join(os.path.dirname(OUT),'ar'),exist_ok=True)
for pid in PILLARS:
    part=dict(pillar=dict(id=pid,name_ar=PILLARS[pid][0],desc_ar=PILLARS[pid][1]),
              subpillars=[s for s in subs if s['pillar']==pid],
              codes=[dict(id=c['id'],desc_ar=c['desc_ar'],requirements=c['requirements'],criteria=c['criteria']) for c in codes if c['pillar']==pid])
    json.dump(part,open(os.path.join(os.path.dirname(OUT),'ar',f'pillar_{pid}.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
nreq=sum(len(c['requirements']) for c in codes); ncrit=sum(len(c['criteria']) for c in codes)
print('pillars',len(pillars),'subpillars',len(subs),'codes',len(codes),'requirements',nreq,'criteria',ncrit,'strings',len(codes)+nreq+ncrit+len(subs)+2*len(pillars))
print('5+ reqs:',[c['id'] for c in codes if len(c['requirements'])>=5],'4 reqs:',[c['id'] for c in codes if len(c['requirements'])==4])
