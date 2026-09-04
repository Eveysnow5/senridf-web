# -*- coding: utf-8 -*-
"""给「大模型用量」卡做一份带假数据的预览副本。

⚠️ 这张卡读的是 Firestore，本地没有凭证也没有数据 —— 光看源码推不出它长什么样，
   更推不出"未量到"那一列会不会真的显示出来。所以把 Firestore 打桩，
   **loadUsage 的逻辑保持真实**，只替换数据源。

假数据是照真实形状造的：流式端点（analyze / translateStream）只有 calls
和 missing_usage、没有 total_tokens —— 这正是这张卡最要证明的那件事。
"""
import io, os, sys
sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "solutions", "demo", "admin.html")
OUT = os.path.join(ROOT, "solutions", "demo", "__preview_usage.html")

STUB = """
<script>
window.__STUB_DAYS = (function () {
  const out = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(2026, 7, 20 + i);
    const day = d.toISOString().slice(0, 10);
    const scale = 0.5 + Math.abs(Math.sin(i * 1.7));
    out.push({
      day,
      calls: Math.round(40 * scale),
      total_tokens: Math.round(120000 * scale),
      completion_tokens: Math.round(30000 * scale),
      reasoning_tokens: Math.round(18000 * scale),
      missing_usage: Math.round(9 * scale),
      by_task: {
        proofread:       { calls: Math.round(6 * scale),  total_tokens: Math.round(52000 * scale) },
        lifestory:       { calls: Math.round(14 * scale), total_tokens: Math.round(41000 * scale),
                           reasoning_tokens: Math.round(18000 * scale) },
        translate:       { calls: Math.round(9 * scale),  total_tokens: Math.round(19000 * scale) },
        summary:         { calls: Math.round(2 * scale),  total_tokens: Math.round(8000 * scale) },
        analyze:         { calls: Math.round(4 * scale),  missing_usage: Math.round(4 * scale) },
        translateStream: { calls: Math.round(5 * scale),  missing_usage: Math.round(5 * scale) },
      },
    });
  }
  return out;
})();
</script>"""

# 只桩掉数据源与鉴权门；loadUsage 本身原样保留
REPL = [
    ("import { auth, db } from '/js/shared/firebase-init.js';",
     "const auth = null, db = null;"),
    ("import { initErrorReporting } from '/js/shared/report-error.js';", ""),
    ("import { ADMINS } from '/js/shared/admins.js';", "const ADMINS = [];"),
    ("import {onAuthStateChanged,signInWithEmailAndPassword,signOut} "
     "from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';",
     "const onAuthStateChanged=()=>{},signInWithEmailAndPassword=()=>{},signOut=()=>{};"),
    ("import {collection,getDocs,query,orderBy,limit,doc,getDoc,updateDoc,addDoc,"
     "deleteDoc,serverTimestamp} "
     "from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';",
     "const collection=(_d,n)=>n, query=()=>null, orderBy=()=>null, limit=()=>null,"
     " doc=()=>null, getDoc=async()=>({exists:()=>false}), updateDoc=async()=>{},"
     " addDoc=async()=>{}, deleteDoc=async()=>{}, serverTimestamp=()=>null;"
     " const getDocs=async(c)=>({forEach:(f)=>{ if(c!=='llm_usage') return;"
     " window.__STUB_DAYS.forEach(x=>f({id:x.day,data:()=>x})); }});"),
    ("initErrorReporting({ db });", ""),
]

TAIL = """
<script>
// 直接显示看板并只跑这张卡，绕开登录门
window.addEventListener('load', function () {
  document.getElementById('gate').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadUsage();
});
</script>"""


def main():
    s = io.open(SRC, encoding="utf-8").read()
    for a, b in REPL:
        assert s.count(a) == 1, f"锚点没命中或不唯一：{a[:60]}"
        s = s.replace(a, b)
    assert "loadUsage" in s
    io.open(OUT, "w", encoding="utf-8").write(STUB + s + TAIL)
    print("生成", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
