# Your own 3D you (from a selfie)

Asked for on 2026-11-25: realistic 3D people "from selfies" ("You two, from selfies"), and that each avatar reaches
the other's phone by itself ("1)": synced, encrypted). This is the data decision (roadmap rule 13), written before
the code.

## What you do

1. Settings → *Your character* → *Your own 3D you* → *Make one at Avaturn*: avaturn.me (free) makes a realistic
   avatar from a selfie and exports it as a `.glb` file. Twodo never talks to Avaturn; you open it yourself.
2. *Import your avatar* and pick the file. Twodo checks it, makes it small, and shows it at once on your phone.
3. It reaches your partner's phone by itself, encrypted. *Use a Twodo person again* takes it back off both phones.

Your avatar moves like the Twodo people (the same motion capture: `lib/mocap.ts` plays it on Avaturn's Mixamo-style
skeleton) and turns round under a finger.

## Checking and shrinking the file (on your phone)

- **Refused** if any of these is true:
  - it is over 40 MB, or isn't a glTF 2 binary (`glTF` header, a JSON chunk);
  - it points anywhere outside itself (any `uri`: nothing is ever downloaded because of a file);
  - it needs an extension Twodo can't read (`extensionsRequired`);
  - it has more than 400,000 vertices;
  - it has no human skeleton Twodo can move (`makeRig`).
- **Made small:** only the colour pictures are kept, 1024 px (JPEG); hair and lashes that need see-through parts keep
  PNG at 512 px. Normal, roughness and other maps are dropped. It is written again with three.js's GLTFExporter, so
  what is kept and synced is Twodo's own file, not the original. A typical Avaturn export (10–20 MB) becomes 1–3 MB.
  Anything still over 6 MB is refused.
- A face picture for small round pictures is drawn from it on each phone (never synced).

## Data

- **People record** (already synced and encrypted): each person may have `model: { h, n }`. `h` is the SHA-256 of
  the shrunk file (64 hex characters), `n` how many pieces it was sent in (1–48). `cleanPerson` keeps `model` only
  in that exact shape. Older app versions keep the field untouched (unknown fields are kept) and still draw the Twodo
  person.
- **The file itself:** encrypted with the space key (AES-GCM, a fresh 12-byte IV, the same scheme as every record;
  `encryptBytes` in `crypto.ts`), base64, cut into pieces of at most 190,000 characters, at
  `spaces/{space}/av/{your uid}/{first 12 of h}/{0…n-1}`. **New path: the Firebase rules change** (below). The pieces
  are written first, then the people record, then the previous version is deleted. Only members can read them; only
  you can write yours.
- **Your partner's phone:** when the people record says your `h` changed, it downloads the pieces once, decrypts them
  (the AES-GCM tag covers the whole file), checks SHA-256 equals `h`, checks the file again as above, and keeps it.
  Any failure: the Twodo person stays.
- **Each phone keeps** the files in a new IndexedDB, `twodo-people` (store `m`, key = `h`): only the ones the people
  record names; others are removed. A kept file was checked before it was kept; read back, its shape is checked again
  (its key must equal its `h`). Cleared on unpair, another account, and *Erase*.
- **Size:** at most 2 × ~4 MB in the database; downloaded once per change.

## The rules change (the owner pastes it into the Firebase console)

Under `spaces/$space` in `firebase.rules.json`:

```json
"av": {
  "$uid": {
    ".write": "auth != null && auth.uid === $uid && root.child('spaces').child($space).child('members').child(auth.uid).exists()",
    "$v": {
      ".validate": "$v.matches(/^[0-9a-f]{12}$/)",
      "$i": { ".validate": "$i.matches(/^[0-9]{1,2}$/) && newData.isString() && newData.val().length <= 190000" }
    }
  }
}
```

Reading is already limited to members (`spaces/$space/.read`). Until the rules are pasted, importing still works on
your own phone; sending fails quietly, and the app says it couldn't send yet.

## Privacy

- Your avatar is a likeness of your face. It is never in the public repository, never on GitHub Pages, and never sent
  anywhere but your shared space, encrypted. Firebase sees only that a file of some size was stored.
- Avaturn keeps what you give Avaturn; that is between you and Avaturn (their free plan). Twodo sends nothing there.
