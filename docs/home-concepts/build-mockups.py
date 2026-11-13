#!/usr/bin/env python3
"""Twodo home-screen concepts: the source of the mockups in this folder.
  python3 build-mockups.py standalone <outdir>   one plain HTML file per screen, plus mockups.html with all nine
(the PNGs are screenshots of those files at 390 x 844, 2x)
Every screen is 390 x 844 (iPhone), light theme, Twodo's own tokens. Fictional data: Abilash (blue) and Deiva (pink)."""
import os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif"
ROUND = "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, sans-serif"
BG, CARD, SUNK, INK, SOFT, LINE = '#FAF8FB', '#FFFFFF', '#F3F0F5', '#000000', '#66636D', '#DDD9E3'
BLUE, BLUE_TINT, BLUE_INK = '#7592DB', '#EBEFFA', '#33437E'
PINK, PINK_TINT, PINK_INK = '#DB82A8', '#FAECF2', '#7E2F52'
ORANGE, ON_COLOR = '#DB9462', '#1B1730'
SHADOW = '0 1px 2px rgba(40,20,60,.05), 0 10px 26px -12px rgba(40,20,60,.2)'

PATHS = {
    'chat': '<path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.3-4.7A8 8 0 1 1 21 11.5z"></path>',
    'plus': '<path d="M12 5v14M5 12h14"></path>',
    # Settings and To-dos use the shapes the app already ships (lucide-react, ISC licence)
    'gear': '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx="12" cy="12" r="3"></circle>',
    'todo': '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="m16 9-5.5 5.5L8 12"></path>',
    'list': '<path d="M9 6.5h11M9 12h11M9 17.5h11"></path><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"></path>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
    'chev': '<path d="M9 6l6 6-6 6"></path>',
    'clock': '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>',
    'offline': '<path d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.3 9.2 4.4 4.4 0 0 0 7 18z"></path><path d="M4 4l16 16"></path>',
    'pin': '<path d="M12 21v-6"></path><path d="M8.5 4h7l-1 6 3 3h-11l3-3-1-6z"></path>',
    'basket': '<path d="M4 10h16l-1.6 9H5.6L4 10z"></path><path d="M8.5 10l2.5-5.5M15.5 10L13 4.5"></path>',
    'cal': '<rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M4 10h16M8 3v4M16 3v4"></path>',
    'heart': '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path>',
}
def icon(name, size=22, color='currentColor', sw=2):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; display: block">{PATHS[name]}</svg>')

def avatar(who, size=36, ring=None):
    letter, color = ('A', BLUE) if who == 'a' else ('D', PINK)
    r = f'; box-shadow: 0 0 0 2px {CARD}, 0 0 0 3.5px {ring}' if ring else ''
    return (f'<span style="width: {size}px; height: {size}px; flex: none; border-radius: 50%; background: {color}; color: {ON_COLOR}; display: inline-flex; '
            f'align-items: center; justify-content: center; font: 700 {round(size * .44)}px {ROUND}{r}">{letter}</span>')
def who_mark(who, size=22):
    """whose to-do it is: one initial, or both overlapping"""
    if who != 'both': return avatar(who, size)
    return (f'<span style="display: inline-flex; flex: none" role="img" aria-label="Both of you">{avatar("a", size)}'
            f'<span style="margin-left: -{round(size * .32)}px; display: inline-flex">{avatar("d", size)}</span></span>')
def ring_color(who): return {'a': BLUE, 'd': PINK}.get(who, SOFT)

def icon_button(name, label):
    return (f'<button type="button" aria-label="{label}" style="width: 44px; height: 44px; flex: none; border: 0; border-radius: 50%; background: {CARD}; color: {INK}; '
            f'box-shadow: {SHADOW}; display: flex; align-items: center; justify-content: center; padding: 0">{icon(name, 22)}</button>')
def badge(text, tint=PINK, ink=ON_COLOR):
    return f'<span style="padding: 2px 8px; border-radius: 999px; background: {tint}; color: {ink}; font: 700 12px/16px {FONT}">{text}</span>'

def actions(new=0, later=False):
    """the two things you do most, in thumb reach, the same in every concept"""
    count = (f'<span style="position: absolute; top: -9px; right: -11px; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 10px; background: {ON_COLOR}; color: #FFFFFF; '
             f'font: 700 12px/20px {FONT}; text-align: center">{new}</span>') if new else ''
    label = f' aria-label="Message Deiva, {new} new"' if new else ''
    sub = f'<span style="font: 500 12px/14px {FONT}">Sends later</span>' if later else ''
    msg = (f'<a href="#"{label} style="flex: 1 1 0; min-width: 0; height: 56px; border-radius: 20px; background: {PINK}; color: {ON_COLOR}; text-decoration: none; display: flex; align-items: center; '
           f'justify-content: center; gap: {16 if new else 10}px; font: 600 16px/20px {FONT}; white-space: nowrap"><span style="position: relative; display: flex">{icon("chat", 22)}{count}</span>'
           f'<span style="display: flex; flex-direction: column"><span>Message Deiva</span>{sub}</span></a>')
    add = (f'<a href="#" style="flex: 1 1 0; min-width: 0; height: 56px; border-radius: 20px; background: {BLUE}; color: {ON_COLOR}; text-decoration: none; display: flex; align-items: center; '
           f'justify-content: center; gap: 8px; font: 600 16px/20px {FONT}; white-space: nowrap">{icon("plus", 22)}<span>Add a to-do</span></a>')
    return f'<nav aria-label="Main actions" style="display: flex; gap: 12px; margin-top: auto">{msg}{add}</nav>'

def top_bar(center=''):
    return (f'<header style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px">{icon_button("gear", "Settings")}'
            f'{center}{icon_button("todo", "All to-dos and lists")}</header>')

def task_row(title, who, meta='', done=False, size=17, pad=0, line=True):
    box = (f'<span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%; background: {ring_color(who)}; color: {ON_COLOR}; display: flex; align-items: center; justify-content: center">{icon("check", 16, ON_COLOR, 2.6)}</span>'
           if done else f'<span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%; border: 2px solid {ring_color(who)}"></span>')
    label = f'Mark {title} as not done' if done else f'Mark {title} as done'
    t_style = f'color: {SOFT}; text-decoration: line-through' if done else f'color: {INK}'
    m = f'<span style="font: 400 13px/18px {FONT}; color: {SOFT}; white-space: nowrap">{meta}</span>' if meta else ''
    border = f'border-bottom: 1px solid {LINE}; ' if line else ''
    return (f'<div style="display: flex; align-items: center; gap: 4px; min-height: 50px; {border}padding: 0 {pad}px">'
            f'<button type="button" aria-label="{label}" style="width: 44px; height: 44px; margin-left: -10px; flex: none; border: 0; background: none; padding: 0; display: flex; align-items: center; justify-content: center">{box}</button>'
            f'<span style="flex: 1 1 0; min-width: 0; font: 400 {size}px/22px {FONT}; {t_style}">{title}</span>{m}{who_mark(who)}</div>')

def more_link(text):
    return (f'<a href="#" style="display: flex; align-items: center; gap: 2px; min-height: 44px; color: {BLUE_INK}; text-decoration: none; font: 600 15px/20px {FONT}">{text}{icon("chev", 18)}</a>')

def offline_strip(text='Offline. Everything here is saved on this phone.'):
    return (f'<div role="status" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; background: {SUNK}; color: {INK}; font: 500 13px/18px {FONT}">'
            f'{icon("offline", 18)}<span>{text}</span></div>')

def bubble(text, mine=False, waiting=False):
    tint, radius = (BLUE_TINT, '18px 18px 6px 18px') if mine else (PINK_TINT, '18px 18px 18px 6px')
    wait = (f'<span style="display: flex; align-items: center; gap: 4px; margin-top: 4px; font: 500 12px/16px {FONT}; color: {SOFT}">{icon("clock", 14)}Waiting to send</span>' if waiting else '')
    return f'<span style="display: block; padding: 10px 14px; border-radius: {radius}; background: {tint}; color: {INK}; font: 400 17px/22px {FONT}">{text}{wait}</span>'

def screen(inner, pad='59px 20px 46px', bg=BG):
    return (f'<div style="width: 390px; height: 844px; box-sizing: border-box; overflow: hidden; background: {bg}; color: {INK}; font-family: {FONT}; '
            f'display: flex; flex-direction: column; gap: 16px; padding: {pad}">{inner}</div>')

# ------------------------------------------------------------------ 1. Postcard
def stamp():
    hearts = (f'<svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true" style="display: block"><path d="M12 26S2 19.5 2 11.5a6 6 0 0 1 10-4.4 6 6 0 0 1 10 4.4C22 19.5 12 26 12 26z" fill="{BLUE}"></path>'
              f'<path d="M22 26s-10-6.5-10-14.5a6 6 0 0 1 10-4.4 6 6 0 0 1 10 4.4C32 19.5 22 26 22 26z" fill="{PINK}" fill-opacity=".88"></path></svg>')
    return (f'<div aria-hidden="true" style="position: relative; width: 62px; height: 74px; flex: none">'
            f'<div style="width: 62px; height: 74px; box-sizing: border-box; border: 2px dashed {BLUE}; border-radius: 6px; background: {BLUE_TINT}; display: flex; align-items: center; justify-content: center">{hearts}</div>'
            f'<svg width="58" height="58" viewBox="0 0 58 58" style="position: absolute; left: -24px; top: 42px"><circle cx="29" cy="29" r="26" fill="none" stroke="{SOFT}" stroke-opacity=".55" stroke-width="1.5"></circle>'
            f'<circle cx="29" cy="29" r="19" fill="none" stroke="{SOFT}" stroke-opacity=".55" stroke-width="1"></circle></svg>'
            f'<span style="position: absolute; left: -24px; top: 62px; width: 58px; text-align: center; font: 700 10px/12px {ROUND}; letter-spacing: .06em; color: {SOFT}">13 NOV</span></div>')

def postcard(state):
    hello = {'busy': 'Good evening,', 'empty': 'Good morning,', 'offline': 'Good evening,'}[state]
    head = (f'<div style="display: flex; justify-content: space-between; gap: 12px"><div style="min-width: 0">'
            f'<p style="margin: 0; font: 600 12px/16px {FONT}; letter-spacing: .08em; color: {SOFT}">FRIDAY 13 NOVEMBER</p>'
            f'<h1 style="margin: 6px 0 0; font: 700 26px/31px {ROUND}; color: {INK}">{hello}<br>Abilash</h1></div>{stamp()}</div>')
    if state == 'empty':
        note = (f'<a href="#" style="display: block; text-decoration: none; color: {INK}"><span style="display: block; font: 600 13px/18px {FONT}; color: {PINK_INK}">From Deiva</span>'
                f'<span style="display: block; margin-top: 6px; font: 400 17px/24px {FONT}; color: {SOFT}">Nothing yet today. Be the first to say good morning.</span></a>')
        today = (f'<h2 style="margin: 0; font: 700 20px/25px {ROUND}">Today, for the two of you</h2>'
                 f'<p style="margin: 8px 0 0; font: 400 17px/24px {FONT}; color: {SOFT}">A blank card. Nothing is planned yet.</p>{more_link("Plan one small thing")}'
                 + ''.join(f'<div aria-hidden="true" style="height: 38px; border-bottom: 1.5px solid #EDE9F2"></div>' for _ in range(4)))
        foot = ''
    else:
        if state == 'offline':
            note = (f'<a href="#" style="display: block; text-decoration: none; color: {INK}"><span style="display: block; font: 600 13px/18px {FONT}; color: {BLUE_INK}">You wrote</span>'
                    f'<span style="display: block; margin-top: 6px">{bubble("On my way. Save me a seat?", mine=True, waiting=True)}</span></a>')
        else:
            note = (f'<a href="#" style="display: block; text-decoration: none; color: {INK}"><span style="display: flex; align-items: center; gap: 8px; font: 600 13px/18px {FONT}; color: {PINK_INK}">From Deiva{badge("2 new")}</span>'
                    f'<span style="display: block; margin-top: 6px">{bubble("See you at 7? I’ll light the candles.")}</span></a>')
        today = (f'<h2 style="margin: 0 0 4px; font: 700 20px/25px {ROUND}">Today, for the two of you</h2>'
                 + task_row('Pick up the cake', 'a', '5:00 pm') + task_row('Call the landlord', 'd', done=(state == 'offline')) + task_row('Plan the Sunday hike', 'both')
                 + task_row('Water the plants', 'a', line=False) + more_link('3 more today'))
        # what your partner did last (not shown offline: it can't be current, and the notice needs the room)
        foot = '' if state == 'offline' else (f'<p style="margin: 0; display: flex; align-items: center; gap: 6px; font: 400 13px/18px {FONT}; color: {SOFT}">{icon("check", 16)}Deiva ticked off Book train tickets</p>')
    strip = offline_strip() if state == 'offline' else ''
    card = (f'<main style="flex: 1 1 0; min-height: 0; box-sizing: border-box; background: {CARD}; border-radius: 24px; box-shadow: {SHADOW}; padding: 22px 22px 18px; display: flex; flex-direction: column; gap: 16px">'
            f'{strip}{head}{note}<div aria-hidden="true" style="border-top: 2px dashed {LINE}"></div><section style="display: flex; flex-direction: column">{today}</section>'
            f'<div style="margin-top: auto">{foot}</div></main>')
    return screen(top_bar() + card + actions(new=2 if state == 'busy' else 0, later=state == 'offline'))

# ------------------------------------------------------------------ 2. Pinboard
def pin(color, left='50%'):
    return (f'<span aria-hidden="true" style="position: absolute; left: {left}; top: -7px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: {color}; '
            f'box-shadow: inset 0 -2px 0 rgba(27,23,48,.22), 0 2px 3px rgba(27,23,48,.3)"></span>')
def note(inner, left, top, width, rot, bg=CARD, tag='a', radius=14, pad='16px 14px 12px', extra=''):
    href = ' href="#"' if tag == 'a' else ''
    return (f'<{tag}{href} style="position: absolute; left: {left}px; top: {top}px; width: {width}px; box-sizing: border-box; padding: {pad}; border-radius: {radius}px; background: {bg}; color: {INK}; '
            f'text-decoration: none; box-shadow: {SHADOW}; transform: rotate({rot}deg); display: block; {extra}">{inner}</{tag}>')
def mini_task(title, who, done=False):
    box = (f'<span style="width: 20px; height: 20px; flex: none; box-sizing: border-box; border-radius: 50%; background: {ring_color(who)}; display: flex; align-items: center; justify-content: center">{icon("check", 13, ON_COLOR, 2.8)}</span>'
           if done else f'<span style="width: 20px; height: 20px; flex: none; box-sizing: border-box; border-radius: 50%; border: 2px solid {ring_color(who)}"></span>')
    st = f'color: {SOFT}; text-decoration: line-through' if done else f'color: {INK}'
    return f'<span style="display: flex; align-items: flex-start; gap: 8px; padding: 5px 0">{box}<span style="font: 400 15px/20px {FONT}; {st}">{title}</span></span>'

def pinboard(state):
    board = f'position: relative; flex: 1 1 0; min-height: 0; border-radius: 28px; background-color: {SUNK}; background-image: radial-gradient(circle, #D8D2E0 1.2px, transparent 1.6px); background-size: 20px 20px'
    title = f'<h1 style="margin: 0; font: 700 20px/25px {ROUND}; color: {INK}">Our board</h1>'
    if state == 'empty':
        slot = lambda text, l, t, w, h, r: (f'<div aria-hidden="true" style="position: absolute; left: {l}px; top: {t}px; width: {w}px; height: {h}px; box-sizing: border-box; border: 2px dashed #BDB5C9; border-radius: 14px; '
                                            f'transform: rotate({r}deg); display: flex; align-items: center; justify-content: center; font: 500 13px/18px {FONT}; color: {SOFT}">{text}</div>')
        inner = (slot('Deiva’s latest message', 16, 30, 186, 96, -2) + slot('Today', 214, 56, 136, 150, 2)
                 + note(f'{pin(BLUE)}<span style="display: block; font: 700 20px/25px {ROUND}">Nothing pinned yet</span>'
                        f'<span style="display: block; margin-top: 8px; font: 400 15px/21px {FONT}; color: {SOFT}">Say hi to Deiva or add a to-do. What matters today pins itself here for both of you.</span>',
                        40, 250, 286, -1, tag='div', pad='22px 18px 18px'))
    else:
        if state == 'offline':
            msg = (f'{pin(BLUE)}<span style="display: block; font: 600 13px/18px {FONT}; color: {BLUE_INK}">You wrote</span>'
                   f'<span style="display: block; margin-top: 4px; font: 400 16px/21px {FONT}">On my way. Save me a seat?</span>'
                   f'<span style="display: flex; align-items: center; gap: 4px; margin-top: 8px; font: 500 12px/16px {FONT}; color: {SOFT}">{icon("clock", 14)}Waiting to send</span>')
            msg_bg = BLUE_TINT
        else:
            msg = (f'{pin(PINK)}<span style="display: flex; align-items: center; gap: 8px; font: 600 13px/18px {FONT}; color: {PINK_INK}">Deiva{badge("2 new", PINK)}</span>'
                   f'<span style="display: block; margin-top: 4px; font: 400 16px/21px {FONT}">See you at 7? I’ll light the candles.</span>'
                   f'<span style="display: flex; align-items: center; gap: 2px; margin-top: 8px; font: 600 13px/18px {FONT}; color: {PINK_INK}">Reply{icon("chev", 15)}</span>')
            msg_bg = PINK_TINT
        today = (f'{pin(BLUE, "38%")}{pin(PINK, "62%")}<span style="display: block; font: 700 17px/22px {ROUND}; margin-bottom: 4px">Today</span>'
                 + mini_task('Pick up the cake', 'a') + mini_task('Call the landlord', 'd', done=(state == 'offline')) + mini_task('Plan the Sunday hike', 'both')
                 + f'<span style="display: block; margin-top: 6px; font: 600 13px/18px {FONT}; color: {BLUE_INK}">4 more</span>')
        us = (f'{pin(PINK)}<span style="display: flex; align-items: center; justify-content: center; height: 96px; border-radius: 8px; background: {BLUE_TINT}">{avatar("a", 52)}<span style="margin-left: -14px; display: inline-flex">{avatar("d", 52)}</span></span>'
              f'<span style="display: block; margin-top: 10px; font: 700 15px/20px {ROUND}; text-align: center">Together</span>'
              f'<span style="display: block; font: 400 13px/18px {FONT}; color: {SOFT}; text-align: center">3 to do as a pair</span>')
        groceries = (f'{pin(BLUE, "22%")}<span style="display: flex; align-items: center; gap: 10px"><span style="width: 36px; height: 36px; flex: none; border-radius: 50%; background: {BLUE_TINT}; color: {BLUE_INK}; display: flex; align-items: center; justify-content: center">{icon("basket", 20)}</span>'
                     f'<span style="min-width: 0"><span style="display: block; font: 600 16px/20px {FONT}">Groceries</span><span style="display: block; font: 400 13px/18px {FONT}; color: {SOFT}">6 to get</span></span></span>')
        pinned = (f'{pin(ORANGE)}<span style="display: flex; align-items: center; gap: 6px; font: 600 12px/16px {FONT}; letter-spacing: .04em; color: #7A4A22">{icon("pin", 14)}PINNED</span>'
                  f'<span style="display: block; margin-top: 4px; font: 600 16px/21px {FONT}">Passport renewal</span><span style="display: block; font: 400 13px/18px {FONT}; color: {SOFT}">Fri 20 Nov · Abilash</span>')
        done = (f'<span style="display: flex; align-items: center; gap: 6px; font: 400 13px/18px {FONT}; color: {INK}">{icon("check", 16, PINK_INK)}Deiva ticked off Book train tickets</span>')
        inner = (note(msg, 14, 28, 178, -2, bg=msg_bg) + note(today, 196, 58, 158, 2, bg='#FFF9E8', pad='18px 12px 12px')
                 + note(us, 22, 196, 150, 3, pad='12px 12px 14px', radius=6) + note(groceries, 192, 298, 162, -1.5, pad='14px 12px 12px')
                 + note(pinned, 30, 420, 204, 1.2) + note(done, 62, 540, 262, -1, tag='div', bg='#F0ECF6', radius=4, pad='10px 12px'))
        if state == 'offline':
            inner += (f'<div role="status" style="position: absolute; left: 50px; top: -10px; width: 266px; box-sizing: border-box; padding: 7px 12px; background: #E4DDED; color: {INK}; transform: rotate(-1.5deg); '
                      f'display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 13px/18px {FONT}; box-shadow: 0 1px 2px rgba(40,20,60,.12)">{icon("offline", 16)}Offline. Your board is saved here.</div>')
    return screen(top_bar(title) + f'<main style="{board}">{inner}</main>' + actions(new=2 if state == 'busy' else 0, later=state == 'offline'), pad='59px 12px 46px')

# ------------------------------------------------------------------ 3. Our day
def ourday(state):
    status = {'busy': 'Deiva is online', 'empty': 'Deiva was here 2 hours ago', 'offline': 'Deiva was here at 6:12 pm'}[state]
    dot = f'<span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 50%; background: #2E9E63"></span>' if state == 'busy' else ''
    pair = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 4px"><div style="display: flex; align-items: center; gap: 6px">{avatar("d", 40, PINK)}'
            f'<svg width="20" height="18" viewBox="0 0 24 22" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{PINK}"></stop><stop offset="1" stop-color="{BLUE}"></stop></linearGradient></defs>'
            f'<path d="M12 21S2 14.5 2 7.5a5.5 5.5 0 0 1 10-3.2A5.5 5.5 0 0 1 22 7.5C22 14.5 12 21 12 21z" fill="url(#g)"></path></svg>{avatar("a", 40, BLUE)}</div>'
            f'<span style="display: flex; align-items: center; gap: 5px; font: 500 13px/18px {FONT}; color: {SOFT}">{dot}{status}</span></div>')
    title = (f'<div><p style="margin: 0; font: 600 12px/16px {FONT}; letter-spacing: .08em; color: {SOFT}">FRIDAY 13 NOVEMBER</p>'
             f'<h1 style="margin: 2px 0 0; font: 700 30px/36px {ROUND}">Our day</h1></div>')
    card = f'display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 20px; background: {CARD}; box-shadow: {SHADOW}; text-decoration: none; color: {INK}'
    if state == 'busy':
        msg = (f'<a href="#" style="{card}">{avatar("d", 40)}<span style="flex: 1 1 0; min-width: 0"><span style="display: flex; align-items: center; gap: 8px; font: 600 15px/20px {FONT}">Deiva{badge("2 new")}'
               f'<span style="margin-left: auto; font: 400 13px/18px {FONT}; color: {SOFT}">6:12 pm</span></span>'
               f'<span style="display: block; margin-top: 2px; font: 400 16px/21px {FONT}">See you at 7? I’ll light the candles.</span></span>{icon("chev", 20, SOFT)}</a>')
    elif state == 'offline':
        msg = (f'<a href="#" style="{card}">{avatar("a", 40)}<span style="flex: 1 1 0; min-width: 0"><span style="display: block; font: 600 15px/20px {FONT}">You</span>'
               f'<span style="display: block; margin-top: 2px; font: 400 16px/21px {FONT}">On my way. Save me a seat?</span>'
               f'<span style="display: flex; align-items: center; gap: 4px; margin-top: 4px; font: 500 12px/16px {FONT}; color: {SOFT}">{icon("clock", 14)}Waiting to send</span></span>{icon("chev", 20, SOFT)}</a>')
    else:
        quick = lambda t: f'<a href="#" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 22px; background: {PINK_TINT}; color: {PINK_INK}; text-decoration: none; font: 600 15px/20px {FONT}">{t}</a>'
        msg = (f'<div style="display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 20px; background: {CARD}; box-shadow: {SHADOW}"><div style="display: flex; align-items: center; gap: 12px">{avatar("d", 40)}'
               f'<span><span style="display: block; font: 600 15px/20px {FONT}">Say hi to Deiva</span><span style="display: block; font: 400 15px/20px {FONT}; color: {SOFT}">No messages yet today.</span></span></div>'
               f'<div style="display: flex; gap: 8px">{quick("Good morning")}{quick("Thinking of you")}</div></div>')
    head = f'<h2 style="margin: 0 0 2px; font: 700 20px/25px {ROUND}">Today</h2>'
    if state == 'empty':
        today = (f'<section>{head}<div style="margin-top: 8px; padding: 18px 16px; border-radius: 20px; border: 2px dashed {LINE}"><p style="margin: 0; font: 400 17px/24px {FONT}; color: {SOFT}">Nothing is planned for today.</p>'
                 f'{more_link("Add one small thing")}</div></section>')
        chips = [('cal', 'Upcoming', ''), ('list', 'All lists', '')]
    else:
        today = (f'<section>{head}' + task_row('Pick up the cake', 'a', '5:00 pm') + task_row('Call the landlord', 'd', done=(state == 'offline')) + task_row('Plan the Sunday hike', 'both')
                 + task_row('Water the plants', 'a', line=False) + more_link('3 more today') + '</section>')
        chips = [('basket', 'Groceries', '6'), ('cal', 'Upcoming', ''), ('list', 'Lists', '')]
    chip = lambda ic, t, n: (f'<a href="#" style="flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 10px; border-radius: 22px; background: {CARD}; box-shadow: {SHADOW}; color: {INK}; text-decoration: none; white-space: nowrap; '
                             f'font: 600 15px/20px {FONT}">{icon(ic, 18, BLUE_INK)}{t}' + (f'<span style="font: 400 15px/20px {FONT}; color: {SOFT}">{n}</span>' if n else '') + '</a>')
    row = f'<nav aria-label="Lists" style="display: flex; gap: 8px">{"".join(chip(*c) for c in chips)}</nav>'
    strip = offline_strip('Offline. Everything here is saved on this phone.') if state == 'offline' else ''
    return screen(top_bar(pair) + strip + title + msg + today + row + actions(new=2 if state == 'busy' else 0, later=state == 'offline'), pad='59px 20px 46px')

SCREENS = [  # (file stem, title, builder, state)
    ('Main', 'Postcard · a busy day', postcard, 'busy'), ('Postcard-empty', 'Postcard · nothing yet', postcard, 'empty'), ('Postcard-offline', 'Postcard · offline', postcard, 'offline'),
    ('Pinboard-busy', 'Pinboard · a busy day', pinboard, 'busy'), ('Pinboard-empty', 'Pinboard · nothing yet', pinboard, 'empty'), ('Pinboard-offline', 'Pinboard · offline', pinboard, 'offline'),
    ('OurDay-busy', 'Our day · a busy day', ourday, 'busy'), ('OurDay-empty', 'Our day · nothing yet', ourday, 'empty'), ('OurDay-offline', 'Our day · offline', ourday, 'offline'),
]

def page(title, body):
    return f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>{title}</title>\n</head>\n<body style="margin: 0">\n{body}\n</body>\n</html>\n'

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'standalone':
        out = sys.argv[2]; os.makedirs(out, exist_ok=True)
        for stem, title, build, state in SCREENS:
            open(os.path.join(out, stem + '.html'), 'w').write(page(title, build(state)))
        rows = ''
        for r, name in enumerate(['1 · Postcard', '2 · Pinboard', '3 · Our day']):
            frames = ''.join(f'<figure style="margin: 0"><div style="border-radius: 36px; overflow: hidden; box-shadow: 0 0 0 1px #DDD9E3">{b(s)}</div>'
                             f'<figcaption style="margin-top: 10px; font: 500 14px/20px {FONT}; color: {SOFT}; text-align: center">{t}</figcaption></figure>' for _, t, b, s in SCREENS[r * 3:r * 3 + 3])
            rows += f'<section style="margin: 0 0 56px"><h2 style="margin: 0 0 20px; font: 700 28px/34px {ROUND}">{name}</h2><div style="display: flex; flex-wrap: wrap; gap: 32px">{frames}</div></section>'
        body = (f'<main style="padding: 40px 32px; background: #EDE9F0; color: {INK}; font-family: {FONT}; min-height: 100%"><h1 style="margin: 0 0 8px; font: 700 34px/40px {ROUND}">Twodo home screen concepts</h1>'
                f'<p style="margin: 0 0 40px; max-width: 760px; font: 400 17px/24px {FONT}; color: {SOFT}">Three directions, each on a busy day, with nothing yet, and offline. Fictional data. See docs/home-concepts.md for the navigation model, tradeoffs and recommendation.</p>{rows}</main>')
        open(os.path.join(out, 'mockups.html'), 'w').write(page('Twodo home screen concepts', body)); print('wrote', len(SCREENS), 'screens + mockups.html')
