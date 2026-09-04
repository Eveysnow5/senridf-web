# -*- coding: utf-8 -*-
"""生成两份预览副本，验证「真题演练」入口的管理员门控。

⚠️ 为什么不能只截一张图：截图答得了"现在长什么样"，答不了"换个人看会怎样"。
   这里要验的恰恰是**两种身份下的两种结果**，所以把 onAuthStateChanged 打桩，
   分别喂管理员和非管理员，再看 DOM。

⚠️ `isAdmin` 必须保留真实实现 —— 它就是被测对象。只桩掉 Firebase 本身。
"""
import io, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "solutions", "demo", "japanese_learner.html")

CASES = {
    "admin": "{ email: 'sherlockafa@gmail.com', isAnonymous: false }",
    "member": "{ email: 'someone@example.com', isAnonymous: false }",
    "guest": "null",
}

REPL = [
    # Firebase 本体打桩；isAdmin 的 import 原样保留
    ("import { auth, db } from '/js/shared/firebase-init.js';",
     "const auth = null, db = null;"),
    ("import { initErrorReporting } from '/js/shared/report-error.js';", ""),
    ("import { onAuthStateChanged, signOut } from "
     "'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';",
     "const onAuthStateChanged = (a, cb) => cb(__FAKE__); const signOut = () => {};"),
    ("initErrorReporting({ db });", ""),
    ('<script type="module" src="/js/tracking.js"></script>', ""),
]


def main():
    s = io.open(SRC, encoding="utf-8").read()
    made = []
    for name, fake in CASES.items():
        t = s
        for a, b in REPL:
            assert t.count(a) == 1, f"锚点没命中或不唯一：{a[:50]}"
            t = t.replace(a, b)
        t = t.replace("__FAKE__", fake)
        out = os.path.join(ROOT, "solutions", "demo", f"__preview_drill_{name}.html")
        io.open(out, "w", encoding="utf-8").write(t)
        made.append(out)
        print("生成", os.path.relpath(out, ROOT))
    return made


if __name__ == "__main__":
    main()
