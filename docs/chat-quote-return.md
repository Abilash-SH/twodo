# Quoted-message navigation and return

This continues the chat reading work after the unread-position fix. The home concepts and navigation redesign are unchanged.

## Causes

The old quote handler increased the render window and queried the target immediately after notifying React. The target was not guaranteed to exist until the commit. Its smooth scroll could also pass the older-history threshold, causing a competing prepend. Ordinary fresh renders could pin the conversation to its end during that same operation. Prepending history previously measured its new height before the commit, so its compensation could be zero.

## Behaviour

A quote captures the current visible message and its offset beneath the header. Its target is requested, history is expanded, and positioning runs after React commits the rows. A finite scroll operation owns the position through settlement; it is not treated as a request to load more history or pin to the bottom. The return button restores the saved message offset, even though more rows now exist above it. Repeated quote jumps retain the original return point.

Older-history prepends use the same post-commit anchor mechanism. Touch/wheel interruption releases programmatic ownership; scrolling remains controlled by the user. The return control preserves an already focused field using the existing tap-keep helper. Reduced Motion positions immediately without a spatial animation. The quote highlight animates opacity only.

All state is transient. No storage key, persisted format, encryption, sync payload, vault behaviour, dependency, backend or third-party origin changes.

## Check on iPhone

1. In a long chat, open a quote whose original is older than the current message window. It should arrive beneath the header without loading more rows mid-jump or snapping to the bottom.
2. Tap “Back to where you were.” The same message should return to the same position.
3. Repeat, interrupt the scroll with a finger, and return again.
4. Scroll up normally to load older messages: the visible message should keep its position.
5. Open/close the keyboard and reply preview while reading history. Try Reduce Motion and landscape.
6. With the keyboard already open, use quote return: focus should remain on the input.

Automated evidence uses Chromium and fake Firebase. Safari keyboard/compositor behaviour still needs a physical iPhone; no device frame-rate claim is made.
