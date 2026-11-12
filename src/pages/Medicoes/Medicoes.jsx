import { useEffect, useMemo, useRef, useState } from "react";

import "./Medicoes.css";
import Modal from "../../components/Modal/Modal";
import { supabase } from "../../services/supabase";

// =====================================================
// GOOGLE DRIVE / APPS SCRIPT
// =====================================================

const GOOGLE_DRIVE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbykcDwsViBK50fZmdSBW1_f9_K7Blz5TPuZICdvLO-LUFsMxG6-5A94A4f1yqe1QufB5Q/exec";

const LOGO_LA_FORTE = "data:image/png;base64,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";
const SIMBOLO_LA_FORTE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCACbAK0DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKACiiigAooooAKKKKACiis7xFr9h4U0HUNZ1S4W106wge5uJn6Iigkn8h0ppNuyA+bf26v2j7z4M+EtN0Pw3e/ZfFmrSrOsyHLW1tG4LPj/bYBBnqN/pXs/wQ+K9h8afhloviux2xtdRbbq3U5+z3C8SRn6N0z1Uqe9fln4ovPFf7Xnx31G5022afUdSMrWdo7YW3tokZkTPQYVevdm969Q/YC+Nr/DX4lS+C9XlaDRfEUgiRZeBb3w4Q89N/wBw++z0r6uvlkYYNKP8SOr+f/Daeh1SguSy3R+nFFFFfJnKFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAV8Of8FGPjh9ksLP4Z6TcYmuQl5rDIfuxg5ihP1I3kegT1r66+J/xC074V+A9Z8Uaow+y6fAZBHnBmkPCRr7sxA/Gvya8OaNr/AO0l8boLe4labVvEWoGW5uAMiGMndIwHZUQHA9FAr6HKMMpTeJqfDD8/+B/kLmsz7D/4Jy/Br/hHvCGo/EDUINt9rRNpYbxylqjfOw/35B+UYPevAP26fg+/wu+Mz69psbW+keIi2oQPH8oiuQR5ygjodxDj/rp7V+nXh7QbLwtoOn6PpsIttPsLdLa3iXoqIoVR+Qryz9q/4Pj4y/B3VdOtoRLrVgP7Q00gfMZkBzGP99Sy/Ug9qWHzF/XnWn8MtPl0+7/Mvmd7ifspfGxPjf8ACaw1G5lVtf0/FlqidzKo4kx6OuG9M7h2r2Svyc/ZE+NLfBT4s2sl9MYvD2rbbHU1Y4WME/JMR6oxyf8AZL+tfrErB1DKQykZBHQ1zZnhPqtd8vwy1X+XyITTFoooryBhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRXmv7Q3xdg+C/ww1PXiyNqTj7Np0Lc+ZcMDt47hQCx9lPrWlOnKrNQgtWJtRV2fHX/BQH41HxX4ut/AWl3G7S9Efzb8oeJbsjhffy1OP95mHau//wCCdnweGl6JqfxC1CDFxf7rHTSw5WFW/eyD/ecBf+2betfHPgnwjq3xa+ImnaLBI9zqms3mJLiTLHLEtJK3rgbmP0NfsD4U8M2Pgzw1pehaZF5Nhp1ultCnfaoxk+pPUnuSa+rzKUcDhIYOnu9/682clGTqycuhq0UUV8gdh+Wf7afwd/4Vf8Ybu7s4PK0TX92oWu0YVJCf30Y+jndjsHWvrn9hz41n4k/DRfD2pXHma/4dVbdi5+ae26RSe5AGw/7qk/erp/2u/hF/wtr4P6hHaw+brekZ1Cw2jLMVB3xj/eTIA/vBfSvzs+BXxSu/gz8TNJ8SW+97aN/JvrdT/rrZsCRfr0Yf7Sivs6a/tTAcn24f0vvX4nFOfsamuzP1/oqppOq2muaXaajYTpc2V3Ck8E0ZysiMAVYfUEVbr41q2jO0KKKKQBRRRQAUUUUAFFFFABRRRQAUUUUAFfmT+2V8Zf8AhavxOk0+wn8zw/oJe0tth+WaXP72X3yQFB9FB719h/tefGX/AIVT8MZrawn8vxBrYa0s9pw0SY/eyj/dUgA/3mX0r84fBnhC+8deK9K0DTU33uo3CW8eei5PLH2AyT7A19dkmFUU8XU2W36v+vM8bHYizVGO59ef8E9vhF5FvqnxBv4fml3afpm8fwg/vpB9SAgPs4r7VrE8FeErHwH4T0nw9pqbLLTrdLePjBbA5Y+7HJPuTXHfHj40WPwc8JtdHZca3dho9Ps2P337uw/uLkE+vA714OJrTx2Jcl129Doq16OW4WVfEStGKu3/AF9yOR/aV/aMHwphg0bQWhuPE05WV/MG9LWLOfmHdmxgD0yfTPonwi+KmmfFzwhb6zp5EU4xHeWZbLW8uOVPqD1B7j3yB8e/AT4N3v7QPizVvEXime5l0lXc3N1u2yXNww4VT225DHHA+UY54y9J1XxH+yd8Ybi2mDXFoGCzxD5Y7+1J+V19G6kHswI9c9ssJScfYwf7xa+vkflNDijMqWIjm2Lg1gqr5Uv5UtpfPW/ezttE/Qyvy0/a3+EP/Cqvi9qC2kPlaJq+dQsdo+VAx/eRj/dfOB/dK1+mvhbxRpvjPw/Za1pFyt1p95GJI5F6+4I7EHII7EGvIP2xPhN/ws74S3dzaQ+ZrWhbr+12j5nQD97GPqozjuUWs8rxLwuJSlonoz9Yr8uIoKpTd1a6a6r/AIJ5p+wH8Zv7X0K6+H2qT5vNOVrnTGc8vbk/PGPdGOR7Mey19gV+OfgTxfqPw88YaV4j0p/LvtPnWZAScOOjI3+yykqfYmv1u8CeM9P+IXhDSvEWlvvstQgWZATyh6Mje6sCp9wa6c5wnsavtor3Zfn/AMH/ADM8DiFVjyPdfkb1FFFfOnphRRRQAUUUUAFFFFABRRRQAVFc3MVlbS3E8iwwRIZJJHOFRQMkk9gBUtfMX7b/AMX/APhFvB8Xg3TZ9uqa2m66KHmK0BwR/wADIK/RX9a6sNh5YmrGlHqc+IrRw9J1JdD5I/aG+K0vxj+JmoawrP8A2VCfsunRNxtgUnBx2LElj/vY7V75+wH8JxJd6n4+voflh3WGm7h/ER+9kH0GEB/2nHavlTw14ZvfFniDTtG06Lzr6/nS3hTtuY4BPoB1J7AV+rHhXQdG+EHw6sdNE8dppOi2f725k+UHAy8je7NuY+5r6/NqscLho4Wl10+X/B/zPmsv/wBoqyxFV6R1v5/8An+IXj7Svhp4VvNe1eXZbQDCRqfnmkP3Y0Hcn9OSeAa/P8y+J/2nvi7Grt/pV6+ABkxWNsp5/wCAqD/wJj6tU3x6+NF/8avF6/Zllj0S1cxadZAHc2TjzGA6u3HHYYHqT9d/s0fBRPhN4PFxfxL/AMJJqarJeMeTCvVYQfbqfVvUAV4kYrAUueXxvbyPgsRiKnGuaLB0G1hKTvJ/zf8AD7R7K78j0fwV4O03wD4X0/QdJi8qys4wi5+87dWdj3Zjkn6159+0h8Fo/i54NZrONV8RacGlsZOhkH8UJPo2OPQgds167RXjQqyhP2iep+sYnLsNi8HLA1Ifu2rW7Lpbtbofn5+zf8c7n4PeJ5NG1oyr4cvJtl1FIDus5s7fNC9RjGGHoPUYr7/gnivLeOaGRJoJVDo6EMrqRkEHuCK+Pv2x/gf9iuH8e6Lb/uJmC6rDGPuOeFnx6HgN74Pc039kf9oL+zZrfwL4iuf9EkbZpd3K3+qY/wDLBj/dJ+76HjuMetiKUcTT+s0t+qPy/IcyrcO455BmUvcv+7k9tdl6P8JXXp8//tOfCb/hVHxX1Kxt4fL0e+P27TyB8oicnKD/AHG3L9AD3r1/9g/4w/2Lrlz4B1KfFnqLG501nPCTgfPGPZ1GR7r6tXtv7ZPwq/4WF8LZdUtIfM1fQN15FtHzPDj98n/fIDfVMd6/O7TL260bUrXULKZra8tZVnhmQ4ZHUgqw+hAr6TDSjmmB9nP4lp81s/68z7HESeX4vmWz1+XVH7GUVwvwV+J1t8W/h3pniCHYly6+TewKf9TcLgOv06MPZhXdV8HOEqcnCS1R9dCcakVOL0YUUUVBYUUUUAFFFFABRRRQBmeJfEVj4S8P6hrOpTCCwsYWnmc/3VGcD1J6AdyRX5XfEvxxffE3xvqviPUCRNeSlkizkQxjhIx7KoA9+T3r6h/bi+LJle28A6bN8q7brVCh6nrFEf8A0Mj/AHK+TdF0K78QavZaZYxGe9vJkghjXqzsQAPzNfdZLhFRpPET3l+X/BPgs6x3tayw9PaP5/8AAPpv9hP4Vi+1rUfHN9D+4sAbOwLjgzMP3jj/AHUIX/gZ9Ko/tWftA/8ACd6nJ4U0C5z4es5P9JnjPF7Kp7HvGp6dieewrd+NvxJtPg78PtP+EvhG5BvILYRatfwnBUtzIgP99yST6A478eOfAr4RXfxg8bQacoeLSrfE2oXS/wDLOLP3Qf7zdB+J7GuGTVarLGVdl8Pp3+Z8Ln+aVa3Jw7lms5O02ure8b9l9p+Vu57F+x18Dv7Wvk8d61b5srZyulwyDiWUcGbHop4H+1k/w19mVV0rS7TRNNtdPsYEtbK1jWGGGMYVEUYAH4VleM/HGkeAtIfUNXuRDHyI4l5kmb+6i9z+g74r5zEVpYio5v5H6vkeT0skwUcLT1e8n3l1f6LyNuaeO2jMk0iRRjGXdgAM8Dk1JXypdXvjH9pbWJoLMDS/D1qSQrk+SjY+XeR99z+g7Dvq+A/jNrXwx1c+FfHUMzW8BCJdPlpIV7HP/LSP0I5Hv0GFj37n0dqOn22rWFxZXkCXNpcRtFNDIMq6MMEEehBr83/j18ILr4O+N5LNPMfR7omfTro/xJnlCf7yHg/ge9fpBYX9tqlnDd2c8dzbTKHjmiYMrA9wRXHfGT4WWPxc8E3Wi3W2K7X97ZXRHMEwHyn6HoR6E98V24PEvDz1+F7nxXFWQRzzB/u1++hrF9+8fn+Dt5nmP7LXx9T4j6MPC3iGZX8Q2kWI5JTn7dCBjJz1cD7w7jn1x8iftCfC1vhT8UNU0mKMppkzfa7BuxgcnC/8BIZP+A+9ZU0Wt/DbxgyEzaVruk3PVTho5FPUeo/Qg9wa+iPijrFl+0z8DF8S2kSReMPCv7zULSPqYWH7xlHUocBx6bWHufpMN/seJU4/BPR+T6P+u58PkudyzTCPL8Y/9opbX3klun/eXXq7epwX7HXxb/4V58QRol/Ns0TXmWBi5+WG46Rv7ZzsP1BP3a/Qyvx/EZUggkEcgjtX6Sfsy/Fn/havw4tnu5d+uaZttL8E/M5A+SX/AIGo/wC+g3pWWeYSzWJgvJ/o/wBPuPvcixynfCzeu6/Vfr9565RRRXyJ9iFFFFABRRRQAVy/xM8e2fw08Eap4hvcMtrH+6iJwZpTwiD6nH0GT2rqK+G/2xvip/wlvi+PwtYTbtL0Vz55U8S3RGG/74Hy/UvXpZfhXi66h0Wr9Dx81x6y/DOp9p6L1/4G58+a/rN74m1u+1bUZjcX17M080h7sxyfoPQdq6z4ca8Ph1Fc+LEiWTVgr2ekbwCscxUeZOR38tGAAPVpAf4TXKWWnTajewWluhkuJ5FijQfxMTgD8zVzxVfQz6hHaWbiSw0+MWsDjpIASWk/4G5ZuegYDtX32LklT9kuv5H4VmOZzwdF1YP33on59X8vwdiDTtP1Pxh4ghtLZJtR1bUZ9qgnc8sjnqSfUnJJ9ya/SP4KfCiy+EPgm20iDZNfyYmvrpR/rpiOcf7I6Aegz1JryD9j74IDw3pS+N9ag26lexkafFIOYICOZPZnHT0X/eNdB8X/ANo6HSvP0fwpKlxecpNqQw0cXqI+zN79B79vh8fifaS9lDZH2/BHD31Gj/aWKX72otL9Iv8AWX5erO3+Kvxq0r4bWzW6FdQ1t1zHZI3CZ6NIf4R7dT+teGeDfBHiT9oDxK+ta7dSx6Sj7ZLnGBgf8soV6D69B1OT1T4Q/BXUPiVf/wBu6888ejtIXaSRj5t62ecE84z1b8BzyPrLT9PttJsoLOzgjtrWFQkcUS4VQOwFeTsfqu5X0HQbDwzpVvpumWyWlnAu1I0H5knuT3J5Nc78S/hhpXxL0j7NeKIL2IE216i5eI+nup7j+R5rsqKkZ8gaF4s8Wfs8eJ5NJ1GFrjTWbc1qzHypVz/rIW7H/wDURnp9QeDPHGkePdITUNIuRNHwJIm4khb+669j+h7ZqPx34C0r4haI+napDnGWhuE/1kL/AN5T/MdDXyZrGj+K/gB4xSWCdosk+TdICYbuPP3WH81PI7djVbi2PQf2vvgf/wAJXozeMtGt92r6fFi9ijHNxbj+L3ZP1XPoBXyL8P8Ax3qPw68S2+sacVcqDHPbScx3MLcPE47qR+XB6iv0I+Ffxo0n4l2otn2WOtKv72yduJPVoyfvD26j9a+Rv2pvggfhl4p/tjSoNvhvVZC0SoPltpurRewPJX2yP4a93AYhSX1ep8v8j8S42yOphaqzvAaNNc1uj6S/R+dn1Z5J4w0qzsdaeXTA/wDZF4PtVj5nLLExPyMe7IQyE+qGuz/Z3+KT/Cb4jWd9NIRo95i01BO3lseHx6ocN9MjvXLaX/xO/Dt1px5urEte2vq0eB5yfgAsg9AknrWJ5dfZwUcVQdOpr0f9f1qebl+ZynGni6ekv1W69PLsz9ao5EmjWSNg6MAyspyCD0INOr59/Y/+Kv8AwmHgpvDV/Nu1bRFCRlj80tr0Q/8AAfun22+tfQVfm2IoSw1WVKW6P3TB4qGMoRr09n+HdBRRRXMdgUUUnSgDzv48fE5PhZ8Pr3UY3X+1Lj/RrBDzmVgfmx6KMt+AHevzlmZ7iZ5ZXaSV2LO7HJYnkkn1r2D9pL4nH4l+P5ltZd+i6XutbPB+Vzn55f8AgRHHsq15XbWUt5cRQQxmWaVwiIvJZicAD8a/Rsqwn1WheXxS1f6I/Ec/zX6/i3Gm7whovPu/n+Vi1pp/sTRb3Vz8s8m6ys/99l/euP8AdQ49jKh7V237O3wps/Gmtz+IPEbpa+D9EIlu5ZzhJ5Oqwj1zwSBzjA6sK5G+05vFPia20LT5UFhp8ZhN11jAUlppye4LFiO5GxeTiu6vtaeTSbLRLPdb6HY5FtaDjcx6yvj70jdSfwGAAK8jMcZa/K9X+CPOyDJ/7dzD6xWV6FHTylLt5rv5WXU9O+Lnx/vPGKy6RoW/TdBA2Mw+WW5Hvj7q/wCyOvf0Gj8EvgDJ4kMGu+I4Wi0nh7ezbhrn0ZvRP1P067PwR/Z83fZ9f8VW/HElrpko6+jyj+S/n6V9HAAAADAHavkm7aI/fkhsMMdtCkUSLFFGoVEQYVQOgA7Cn0UVIwooooAKyPFXhTTPGejTaXqtstxay/gyN2ZT2I9a16KAPiT4lfC/WfhLrkU0csr2Jk3WepQ5UgjkAkfdcfr1Ht6D4Y+Lej/Fbwtc+CfiBsjN5H5UWp8Kpb+Bm7I4OCG6Hvjv9Ga1olj4i0y407UbZLuznXbJFIOD/gR2I5FfH/xh+Ct98OLtry133ugStiO4xloSeiSf0PQ+x4rSMmndbmNWlCtCVOorxkrNPqmeE+LfC2r/AAc+IEunXiKbuwmEkUhX93cxH7rD1R14I9yD3qn4g0yGx1DdabjYXKC4tWbkmJugJ7lTlD/tK1eha95/j7Q7bSLyUTX9kpGl3Mp+cf8ATuzf3G/hz91sdAWrhtI3aroF1psqlb7S2a4hVhhjESBLHjr8pw4HYGU19tluLVSze+z/AEZ/O+OyufD+PlhP+XVT3oP03XrbR9/d7l/4X+Orv4Z+N9M1+03MLd9s8IOPOhPDp+I6ehAPav0s0fV7TX9Js9SsZluLO7iWaGVejKwyDX5aeXX1p+xt8UPPtLnwRqE37yHdc6cWPVOskY+h+YfVvSjO8J7WmsRBax39P+AfZ8K5qqVd4Oo/dnt/i/4P52PqOiiivhT9bCvGv2n/AInf8IL4FfTbKXZrGsBoIyp+aKLH7x/bg7R7tntXr95eQ6faT3VzKsNvAjSySOcBFAySfYAV+enxc8ez/Ezxzf6w+5bXPk2kTf8ALOFSdo+p5Y+7GvcyjB/Wa/NJe7HX59EfF8U5sstwfs4P95U0Xkur/Reb8jg/LrTsHOi6Xd6sAftP/HpZKByZnHLj/cTJyOQzR1BFbSTypHGheRyFVVGSSegFdzpWhytqlkbSFrya0Y2elQRDcZrndia5AHUBwUQ99in+Ag/Y5hiY4ei79T8Yy/C18yrKhh/iel+3eT9Fr62XUz9H0FvDOnLpMSGTVbplN6Yxlt2flgGOu09fV/Xapr6i+CXwATw+INe8SQrLqnD29k/K2/ozer+3QfXpr/Bf4FW/gaKPV9YVLvxA4yq/eS1z2X1b1b8B6n1+vzirVlVk5S6n9FZfgKOW4aGFw6tGK+/u35vdhRRRWJ6IUUUUAFFFFABRRRQAVBe2NvqVnNa3cKXFtMpSSKRdyup6gip6KAPkb40/Ai48ESS6xoqPc6Cxy6cs9pnsfVPRu3Q+p8U8RxSRXUHi2yjEt5auBqcB6TKfl8w+zg7H92B53nH6QyxJNG8ciLJG4KsrDIIPUEV8z/GH4FSeFribxF4Ythc6YQxvNMILCNCCHwO8ZBII6jPHHTrw9d0ZqR4Gd5TTzfCOhLSS1jL+WS2f+fkfLetabHY37C2dpbOVVmtpG6tEwyufcA4I7EEdqk8N65e+FNesNY0+QxXllMs0bdsg9D6gjII9Ca3dS0JYdKa3ty81tahrqwkfljbMwEkLH+9FIwOO4kZuARXM+UfSv0rD1Y4mipb33P58r+2wdflmuWcX9zX/AAdn1Vn1P0n8DeL7Px54U03XbE/uLuIOUzkxv0ZD7hgR+FbtfH/7JPxKOgeIJvCl9LtsdTbzLUseI7gD7v8AwMDH1UetfYFfnWPwrwld0+m69D+g8jzOObYKNdfFtL1X+e69T57/AGsviT/ZOiQ+E7GXF3qCiW8KnlIAeF/4ER+Sn1r5K8uvS/iuTqnxJ8ST3bNPKL6WMMzHhVYqo+gAA/CuU/s63/55/wDjxr7zL6MMNh4wW71fqz8C4gx9bMswqVZaJPlS7Jf57v1Nr4VeBr3xRqU1zawSyfZsRxmEfN5z527SejABmB6KQpPGa+u/hb8IrHwFCt7cRwz608Yj3xj93axgYEUWeQoGBk8t1NZn7M+l2lj8LrSWCBI5Z7iZ5HHJY7tuSfooH4V6vXxua4qVfESj0jp9x+zcKZXSwOX06286iTb9dUvyv3CiiivFPtgooooAKKKKACiiigAooooAKKKKACjrRRQB4Z8TvgZD9ol1jQbdfJdzLc6cowFYgqzxgcgMrMroOqsSo3BRXyd4o8OTeGNeu9NnVg0TZQsOWQjKN+KkGv0kr5c/ay0ayHifRLkW6rPLaMruuRuCvxnHpuNfTZJipQrexez/AEPzDjbKqdTC/X4aTi1fzT0+/b5aHzdayy2VzFcQSNDPE4kjkQ4KsDkEH1Br9APhD8QYviT4HstVyovVHkXka/wTKBu49Dww9jXw1/Z1v/zz/wDHjXa/DrxLqnhJL9dIvZbFZzGZBGchiN2OufU17+Z4RYykraSW36nwPDGcTyjFPnV6c1ql3WzX5ejP/9k=";

const TAMANHO_LOTE_FOTOS = 100;

// =====================================================
// COMPONENTE
// =====================================================

export default function Medicoes({ contratoSelecionado: contratoSelecionadoProp } = {}) {
  const contratoIdContexto = Number(contratoSelecionadoProp?.id ?? contratoSelecionadoProp) || null;
  const [medicoes, setMedicoes] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const [medicao, setMedicao] = useState({
    id: null,
    contrato_id: "",
    numero: "",
    data_inicio: "",
    data_fim: "",
    status: "em_andamento",
    observacao: "",
  });

  // ===================================================
  // FRENTES DA MEDIÇÃO
  // ===================================================

  const [frentes, setFrentes] = useState([]);
  const [frentesSelecionadas, setFrentesSelecionadas] = useState([]);
  const [carregandoFrentes, setCarregandoFrentes] = useState(false);

  // ===================================================
  // FOTOS
  // ===================================================

  const [modalFotosAberto, setModalFotosAberto] = useState(false);
  const [medicaoFotosAtual, setMedicaoFotosAtual] = useState(null);
  const [fotosPorFrente, setFotosPorFrente] = useState({});
  const [carregandoFotos, setCarregandoFotos] = useState(false);
  const [erroFotos, setErroFotos] = useState("");
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  // ===================================================
  // SELEÇÃO DAS FOTOS PARA O RELATÓRIO
  // ===================================================

  const [fotosSelecionadas, setFotosSelecionadas] = useState({});
  const [carregandoSelecao, setCarregandoSelecao] = useState(false);
  const [salvandoSelecao, setSalvandoSelecao] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [salvandoWord, setSalvandoWord] = useState(false);
  const [progressoWord, setProgressoWord] = useState("");
  const [erroWord, setErroWord] = useState("");
  const [wordAtualizado, setWordAtualizado] = useState(null);
  const [selecaoFotoAlterada, setSelecaoFotoAlterada] = useState(false);
  const cacheImagensRef = useRef(new Map());

  // =====================================================
  // CARREGAR CONTRATOS
  // =====================================================

  async function carregarContratos() {
    const { data, error } = await supabase
      .from("contratos")
      .select("id, numero, nome, status")
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar contratos:", error);
      alert(`Não foi possível carregar os contratos.\n\n${error.message}`);
      return;
    }

    setContratos(data || []);
  }

  // =====================================================
  // CARREGAR MEDIÇÕES
  // =====================================================

  async function carregarMedicoes() {
    setCarregando(true);

    try {
      let consulta = supabase
        .from("medicoes")
        .select(`
          *,
          contratos (
            id,
            numero,
            nome
          )
        `);
      if (contratoIdContexto) consulta = consulta.eq("contrato_id", contratoIdContexto);
      const { data, error } = await consulta.order("id", { ascending: false });

      if (error) {
        console.error("Erro ao carregar medições:", error);
        alert(`Não foi possível carregar as medições.\n\n${error.message}`);
        return;
      }

      setMedicoes(data || []);
    } finally {
      setCarregando(false);
    }
  }

  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================

  useEffect(() => {
    carregarContratos();
    carregarMedicoes();
  }, [contratoIdContexto]);

  // =====================================================
  // CARREGAR FRENTES DO CONTRATO
  // =====================================================

  async function carregarFrentesDoContrato(contratoId, medicaoId = null) {
    if (!contratoId) {
      setFrentes([]);
      setFrentesSelecionadas([]);
      return;
    }

    setCarregandoFrentes(true);

    try {
      const { data: frentesData, error: erroFrentes } = await supabase
        .from("frentes")
        .select("*")
        .eq("contrato_id", Number(contratoId))
        .order("ordem", { ascending: true });

      if (erroFrentes) {
        console.error("Erro ao carregar frentes:", erroFrentes);
        alert(`Não foi possível carregar as frentes.\n\n${erroFrentes.message}`);
        setFrentes([]);
        setFrentesSelecionadas([]);
        return;
      }

      setFrentes(frentesData || []);

      if (!medicaoId) {
        setFrentesSelecionadas([]);
        return;
      }

      const { data: links, error: erroLinks } = await supabase
        .from("medicao_frentes")
        .select("frente_id")
        .eq("medicao_id", Number(medicaoId));

      if (erroLinks) {
        console.error("Erro ao carregar frentes da medição:", erroLinks);
        alert(
          `Não foi possível carregar as frentes da medição.\n\n${erroLinks.message}`
        );
        setFrentesSelecionadas([]);
        return;
      }

      setFrentesSelecionadas(
        (links || []).map((item) => Number(item.frente_id))
      );
    } finally {
      setCarregandoFrentes(false);
    }
  }

  // =====================================================
  // ALTERAR CONTRATO
  // =====================================================

  async function alterarContrato(contratoId) {
    setMedicao((anterior) => ({
      ...anterior,
      contrato_id: contratoId,
    }));

    setFrentesSelecionadas([]);

    if (contratoId) {
      await carregarFrentesDoContrato(contratoId);
    } else {
      setFrentes([]);
    }
  }

  // =====================================================
  // NOVA MEDIÇÃO
  // =====================================================

  async function novaMedicao() {
    setMedicao({
      id: null,
      contrato_id: contratoIdContexto || "",
      numero: "",
      data_inicio: "",
      data_fim: "",
      status: "em_andamento",
      observacao: "",
    });

    setFrentes([]);
    setFrentesSelecionadas([]);
    if (contratoIdContexto) await carregarFrentesDoContrato(contratoIdContexto);
    setModalAberto(true);

  }

  // =====================================================
  // EDITAR MEDIÇÃO
  // =====================================================

  async function editarMedicao(item) {
    setMedicao({
      id: item.id,
      contrato_id: item.contrato_id || "",
      numero: item.numero || "",
      data_inicio: item.data_inicio || "",
      data_fim: item.data_fim || "",
      status: item.status || "em_andamento",
      observacao: item.observacao || "",
    });

    setModalAberto(true);
    await carregarFrentesDoContrato(item.contrato_id, item.id);
  }

  // =====================================================
  // SELECIONAR / DESMARCAR FRENTE
  // =====================================================

  function alternarFrente(frenteId) {
    const id = Number(frenteId);

    setFrentesSelecionadas((anterior) => {
      if (anterior.includes(id)) {
        return anterior.filter((item) => item !== id);
      }

      return [...anterior, id];
    });
  }

  // =====================================================
  // SELECIONAR TODAS AS FRENTES
  // =====================================================

  function selecionarTodasFrentes() {
    const ids = frentes
      .filter((frente) => (frente.status || "ativo") === "ativo")
      .map((frente) => Number(frente.id));

    setFrentesSelecionadas(ids);
  }

  // =====================================================
  // DESMARCAR TODAS AS FRENTES
  // =====================================================

  function desmarcarTodasFrentes() {
    setFrentesSelecionadas([]);
  }

  // =====================================================
  // SALVAR MEDIÇÃO
  // =====================================================

  async function salvarMedicao(evento) {
    evento.preventDefault();

    if (!medicao.contrato_id) {
      alert("Selecione o contrato.");
      return;
    }

    if (!medicao.numero || Number(medicao.numero) < 1) {
      alert("Informe um número de medição válido.");
      return;
    }

    if (frentesSelecionadas.length === 0) {
      alert("Selecione pelo menos uma frente para esta medição.");
      return;
    }

    setSalvando(true);

    const dados = {
      contrato_id: Number(medicao.contrato_id),
      numero: Number(medicao.numero),
      data_inicio: medicao.data_inicio || null,
      data_fim: medicao.data_fim || null,
      status: medicao.status === "fechada" ? "fechada" : "em_andamento",
      observacao: medicao.observacao?.trim() || "",
    };

    try {
      let medicaoId = medicao.id;

      if (medicao.id) {
        const { error } = await supabase
          .from("medicoes")
          .update(dados)
          .eq("id", medicao.id);

        if (error) {
          console.error("Erro ao atualizar medição:", error);
          alert(`Não foi possível atualizar a medição.\n\n${error.message}`);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("medicoes")
          .insert([dados])
          .select("id")
          .single();

        if (error) {
          console.error("Erro ao criar medição:", error);
          alert(`Não foi possível criar a medição.\n\n${error.message}`);
          return;
        }

        medicaoId = data.id;
      }

      const { error: erroExcluirLinks } = await supabase
        .from("medicao_frentes")
        .delete()
        .eq("medicao_id", Number(medicaoId));

      if (erroExcluirLinks) {
        console.error("Erro ao limpar frentes da medição:", erroExcluirLinks);
        alert(
          `A medição foi salva, mas não foi possível atualizar as frentes.\n\n${erroExcluirLinks.message}`
        );
        return;
      }

      const registrosFrentes = frentesSelecionadas.map((frenteId) => ({
        medicao_id: Number(medicaoId),
        frente_id: Number(frenteId),
      }));

      const { error: erroInserirLinks } = await supabase
        .from("medicao_frentes")
        .insert(registrosFrentes);

      if (erroInserirLinks) {
        console.error("Erro ao vincular frentes:", erroInserirLinks);
        alert(
          `A medição foi salva, mas não foi possível vincular as frentes.\n\n${erroInserirLinks.message}`
        );
        return;
      }

      await carregarMedicoes();

      setModalAberto(false);
      setMedicao({
        id: null,
        contrato_id: "",
        numero: "",
        data_inicio: "",
        data_fim: "",
        status: "em_andamento",
        observacao: "",
      });

      setFrentes([]);
      setFrentesSelecionadas([]);
    } finally {
      setSalvando(false);
    }
  }

  // =====================================================
  // EXCLUIR MEDIÇÃO
  // =====================================================

  async function excluirMedicao(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir esta medição?\n\n" +
        "As fotos selecionadas para o relatório desta medição também serão excluídas do sistema.\n\n" +
        "Os arquivos originais do Google Drive NÃO serão apagados."
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("medicoes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao excluir medição:", error);
      alert(`Não foi possível excluir a medição.\n\n${error.message}`);
      return;
    }

    await carregarMedicoes();
  }

  // =====================================================
  // STATUS
  // =====================================================

  function mostrarStatus(status) {
    return status === "fechada" ? "Fechada" : "Em andamento";
  }

  // =====================================================
  // FORMATAÇÃO DE DATA
  // =====================================================

  function formatarData(data) {
    if (!data) return "-";

    const partes = data.split("-");
    if (partes.length !== 3) return data;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  // =====================================================
  // FRENTES VISÍVEIS NO FORMULÁRIO
  // =====================================================

  const frentesOrdenadas = useMemo(
    () =>
      [...frentes].sort(
        (a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)
      ),
    [frentes]
  );

  // =====================================================
  // BUSCAR FOTOS DA FRENTE
  // =====================================================

  async function buscarFotosDaFrente(frente, numeroMedicao) {
    const drivePastaId = frente.drive_pasta_id;

    if (!drivePastaId) {
      return {
        frente,
        ok: false,
        erro: "Esta frente não possui uma pasta do Google Drive cadastrada.",
        fotos: [],
        videos: [],
        outros: [],
        quantidade: { fotos: 0, videos: 0, outros: 0, total: 0 },
      };
    }

    try {
      const url =
        `${GOOGLE_DRIVE_SCRIPT_URL}` +
        `?drive_pasta_id=${encodeURIComponent(drivePastaId)}` +
        `&medicao=${encodeURIComponent(numeroMedicao)}`;

      const resposta = await fetch(url);

      if (!resposta.ok) {
        throw new Error(`Erro HTTP ${resposta.status}`);
      }

      const resultado = await resposta.json();

      if (!resultado.ok) {
        return {
          frente,
          ok: false,
          erro:
            resultado.mensagem ||
            resultado.erro ||
            "O Google Apps Script retornou um erro.",
          fotos: resultado.fotos || [],
          videos: resultado.videos || [],
          outros: resultado.outros || [],
          quantidade: resultado.quantidade || {
            fotos: 0,
            videos: 0,
            outros: 0,
            total: 0,
          },
          pastaFotos: resultado.pastaFotos || null,
          pastaMedicao: resultado.pastaMedicao || null,
        };
      }

      return {
        frente,
        ok: true,
        erro: "",
        encontrada: resultado.encontrada !== false,
        pastaFotos: resultado.pastaFotos || null,
        pastaMedicao: resultado.pastaMedicao || null,
        quantidade: resultado.quantidade || {
          fotos: 0,
          videos: 0,
          outros: 0,
          total: 0,
        },
        fotos: (resultado.fotos || []).map((arquivo) => ({
          ...arquivo,
          _drive_pasta_id: String(drivePastaId),
          _medicao: String(numeroMedicao),
        })),
        videos: resultado.videos || [],
        outros: resultado.outros || [],
      };
    } catch (error) {
      console.error("Erro ao buscar fotos da frente:", frente.nome, error);

      return {
        frente,
        ok: false,
        erro: error?.message || "Não foi possível consultar o Google Drive.",
        fotos: [],
        videos: [],
        outros: [],
        quantidade: { fotos: 0, videos: 0, outros: 0, total: 0 },
      };
    }
  }

  // =====================================================
  // CARREGAR SELEÇÕES EXISTENTES
  // =====================================================

  async function carregarFotosSelecionadas(medicaoId) {
    if (!medicaoId) return {};

    setCarregandoSelecao(true);

    try {
      const { data, error } = await supabase
        .from("relatorio_fotos")
        .select(`
          id,
          contrato_id,
          frente_id,
          medicao_id,
          drive_arquivo_id,
          nome_arquivo,
          mime_type,
          tamanho,
          legenda,
          ordem
        `)
        .eq("medicao_id", Number(medicaoId))
        .order("ordem", { ascending: true });

      if (error) {
        console.error("Erro ao carregar fotos selecionadas:", error);
        alert(
          `Não foi possível carregar as fotos selecionadas.\n\n${error.message}`
        );
        return {};
      }

      const mapa = {};

      (data || []).forEach((foto) => {
        mapa[String(foto.drive_arquivo_id)] = {
          frente_id: Number(foto.frente_id),
          drive_arquivo_id: String(foto.drive_arquivo_id),
          nome_arquivo: foto.nome_arquivo || "",
          mime_type: foto.mime_type || "",
          tamanho: foto.tamanho || 0,
          legenda: foto.legenda || "",
          ordem: foto.ordem || null,
        };
      });

      return mapa;
    } catch (error) {
      console.error("Erro inesperado ao carregar seleção:", error);
      alert(
        `Ocorreu um erro ao carregar a seleção de fotos.\n\n${error.message || error}`
      );
      return {};
    } finally {
      setCarregandoSelecao(false);
    }
  }

  // =====================================================
  // ABRIR FOTOS DA MEDIÇÃO
  // =====================================================

  async function abrirFotosMedicao(item) {
    setMedicaoFotosAtual(item);
    setFotosPorFrente({});
    setFotosSelecionadas({});
    setWordAtualizado(null);
    setErroWord("");
    setSelecaoFotoAlterada(false);
    setErroFotos("");
    setFotoAmpliada(null);
    setModalFotosAberto(true);
    setCarregandoFotos(true);

    try {
      const selecaoSalva = await carregarFotosSelecionadas(item.id);
      setFotosSelecionadas(selecaoSalva);

      const { data: links, error: erroLinks } = await supabase
        .from("medicao_frentes")
        .select("frente_id")
        .eq("medicao_id", Number(item.id));

      if (erroLinks) {
        console.error("Erro ao carregar frentes da medição:", erroLinks);
        setErroFotos(
          `Não foi possível carregar as frentes da medição.\n\n${erroLinks.message}`
        );
        return;
      }

      const idsFrentes = (links || []).map((link) => Number(link.frente_id));

      if (idsFrentes.length === 0) {
        setErroFotos("Esta medição não possui frentes vinculadas.");
        return;
      }

      const { data: frentesDaMedicao, error: erroFrentes } = await supabase
        .from("frentes")
        .select("*")
        .in("id", idsFrentes);

      if (erroFrentes) {
        console.error("Erro ao carregar dados das frentes:", erroFrentes);
        setErroFotos(
          `Não foi possível carregar os dados das frentes.\n\n${erroFrentes.message}`
        );
        return;
      }

      const mapaFrentes = new Map(
        (frentesDaMedicao || []).map((frente) => [
          Number(frente.id),
          frente,
        ])
      );

      const listaFrentes = idsFrentes
        .map((id) => mapaFrentes.get(id))
        .filter(Boolean);

      const resultados = await Promise.all(
        listaFrentes.map((frente) =>
          buscarFotosDaFrente(frente, item.numero)
        )
      );

      const novoMapa = {};

      resultados.forEach((resultado) => {
        novoMapa[resultado.frente.id] = resultado;
      });

      setFotosPorFrente(novoMapa);
      if (item.status !== "fechada") {
        await carregarWordSalvoDoDrive(item, listaFrentes);
      }
    } catch (error) {
      console.error("Erro ao abrir fotos da medição:", error);
      setErroFotos(
        `Ocorreu um erro ao abrir as fotos.\n\n${error.message || error}`
      );
    } finally {
      setCarregandoFotos(false);
    }
  }

  // =====================================================
  // TOTAL DE FOTOS
  // =====================================================

  const totalFotos = useMemo(
    () =>
      Object.values(fotosPorFrente).reduce(
        (total, resultado) => total + (resultado.fotos?.length || 0),
        0
      ),
    [fotosPorFrente]
  );

  // =====================================================
  // TOTAL DE FOTOS SELECIONADAS
  // =====================================================

  const totalFotosSelecionadas = Object.keys(fotosSelecionadas).length;

  // =====================================================
  // ALTERNAR FOTO
  // =====================================================

  function alternarFoto(arquivo, frente) {
    if (!arquivo?.id) return;

    const id = String(arquivo.id);
    setSelecaoFotoAlterada(true);

    setFotosSelecionadas((anterior) => {
      const novo = { ...anterior };

      if (novo[id]) {
        delete novo[id];
        return novo;
      }

      novo[id] = {
        frente_id: Number(frente.id),
        drive_arquivo_id: id,
        nome_arquivo: arquivo.nome || "",
        mime_type: arquivo.tipo || "",
        tamanho: arquivo.tamanho || 0,
        legenda: "",
      };

      return novo;
    });
  }

  // =====================================================
  // VERIFICAR SE FOTO ESTÁ SELECIONADA
  // =====================================================

  function fotoEstaSelecionada(arquivo) {
    if (!arquivo?.id) return false;

    return Boolean(fotosSelecionadas[String(arquivo.id)]);
  }

  function atualizarLegendaFoto(arquivoId, legenda) {
    const id = String(arquivoId);
    setSelecaoFotoAlterada(true);
    setFotosSelecionadas((anterior) => {
      if (!anterior[id]) return anterior;
      return {
        ...anterior,
        [id]: { ...anterior[id], legenda },
      };
    });
  }

  // =====================================================
  // SELECIONAR TODAS AS FOTOS
  // =====================================================

  function selecionarTodasFotos() {
    setSelecaoFotoAlterada(true);
    const novoMapa = { ...fotosSelecionadas };

    Object.values(fotosPorFrente).forEach((resultado) => {
      const frenteId = Number(resultado.frente.id);

      (resultado.fotos || []).forEach((arquivo) => {
        if (!arquivo?.id) return;

        const id = String(arquivo.id);

        novoMapa[id] = {
          frente_id: frenteId,
          drive_arquivo_id: id,
          nome_arquivo: arquivo.nome || "",
          mime_type: arquivo.tipo || "",
          tamanho: arquivo.tamanho || 0,
          legenda: fotosSelecionadas[id]?.legenda || "",
        };
      });
    });

    setFotosSelecionadas(novoMapa);
  }

  // =====================================================
  // DESMARCAR TODAS AS FOTOS
  // =====================================================

  function desmarcarTodasFotos() {
    setSelecaoFotoAlterada(true);
    setFotosSelecionadas({});
  }

  // =====================================================
  // SELECIONAR / DESMARCAR FOTOS DE UMA FRENTE
  // =====================================================

  function selecionarFotosDaFrente(resultado) {
    setSelecaoFotoAlterada(true);
    const fotos = resultado.fotos || [];
    const frenteId = Number(resultado.frente.id);

    const todasSelecionadas =
      fotos.length > 0 &&
      fotos.every((arquivo) => fotoEstaSelecionada(arquivo));

    setFotosSelecionadas((anterior) => {
      const novo = { ...anterior };

      fotos.forEach((arquivo) => {
        if (!arquivo?.id) return;

        const id = String(arquivo.id);

        if (todasSelecionadas) {
          delete novo[id];
        } else {
          novo[id] = {
            frente_id: frenteId,
            drive_arquivo_id: id,
            nome_arquivo: arquivo.nome || "",
            mime_type: arquivo.tipo || "",
            tamanho: arquivo.tamanho || 0,
            legenda: anterior[id]?.legenda || "",
          };
        }
      });

      return novo;
    });
  }

  // =====================================================
  // SALVAR SELEÇÃO DAS FOTOS
  // =====================================================

  async function salvarSelecaoFotos() {
    if (!medicaoFotosAtual?.id) {
      alert("Não foi possível identificar a medição.");
      return;
    }

    if (!medicaoFotosAtual?.contrato_id) {
      alert("Não foi possível identificar o contrato da medição.");
      return;
    }

    if (carregandoFotos || carregandoSelecao) {
      alert("Aguarde o carregamento das fotos antes de salvar.");
      return;
    }

    setSalvandoSelecao(true);

    let selecaoAnteriorExcluida = false;
    let quantidadeSalva = 0;

    try {
      const medicaoId = Number(medicaoFotosAtual.id);
      const contratoId = Number(medicaoFotosAtual.contrato_id);

      const registros = [];
      const idsIncluidos = new Set();

      Object.values(fotosPorFrente).forEach((resultado) => {
        const frenteId = Number(resultado.frente.id);

        (resultado.fotos || []).forEach((arquivo) => {
          if (!arquivo?.id) return;

          const id = String(arquivo.id);
          const fotoSelecionada = fotosSelecionadas[id];

          if (!fotoSelecionada || idsIncluidos.has(id)) return;

          registros.push({
            contrato_id: contratoId,
            frente_id: frenteId,
            medicao_id: medicaoId,
            drive_arquivo_id: id,
            nome_arquivo: arquivo.nome || null,
            mime_type: arquivo.tipo || null,
            tamanho: arquivo.tamanho || null,
            legenda: fotoSelecionada.legenda?.trim() || null,
            ordem: registros.length + 1,
          });

          idsIncluidos.add(id);
        });
      });

      const selecionadasRestantes = Object.values(fotosSelecionadas)
        .filter(
          (foto) =>
            foto?.drive_arquivo_id &&
            !idsIncluidos.has(String(foto.drive_arquivo_id))
        )
        .sort((a, b) => Number(a.ordem || 999999) - Number(b.ordem || 999999));

      selecionadasRestantes.forEach((foto) => {
        const id = String(foto.drive_arquivo_id);

        registros.push({
          contrato_id: contratoId,
          frente_id: Number(foto.frente_id),
          medicao_id: medicaoId,
          drive_arquivo_id: id,
          nome_arquivo: foto.nome_arquivo || null,
          mime_type: foto.mime_type || null,
          tamanho: foto.tamanho || null,
          legenda: foto.legenda?.trim() || null,
          ordem: registros.length + 1,
        });

        idsIncluidos.add(id);
      });

      const { error: erroExcluir } = await supabase
        .from("relatorio_fotos")
        .delete()
        .eq("medicao_id", medicaoId);

      if (erroExcluir) {
        console.error("Erro ao limpar seleção anterior:", erroExcluir);
        alert(
          `Não foi possível salvar a seleção.\n\n${erroExcluir.message}`
        );
        return;
      }

      selecaoAnteriorExcluida = true;

      if (registros.length === 0) {
        alert(
          "A seleção foi salva.\n\nNenhuma foto está selecionada para o relatório."
        );
        return;
      }

      for (
        let inicio = 0;
        inicio < registros.length;
        inicio += TAMANHO_LOTE_FOTOS
      ) {
        const lote = registros.slice(
          inicio,
          inicio + TAMANHO_LOTE_FOTOS
        );

        const { error: erroInserir } = await supabase
          .from("relatorio_fotos")
          .insert(lote);

        if (erroInserir) {
          console.error(
            `Erro ao salvar o lote de fotos iniciado em ${inicio + 1}:`,
            erroInserir
          );

          throw new Error(
            `Ocorreu um erro ao salvar o lote de fotos iniciado em ${inicio + 1}.\n${erroInserir.message}`
          );
        }

        quantidadeSalva += lote.length;
      }

      setSelecaoFotoAlterada(false);
      if (medicaoFotosAtual.status === "fechada") {
        alert(`${quantidadeSalva} foto(s) salvas. Como a medição está fechada, o relatório final existente foi preservado.`);
      } else {
        const wordSincronizado = await sincronizarRelatorioWord({ silencioso: true, aposSalvarSelecao: true });
        alert(wordSincronizado
          ? `${quantidadeSalva} foto(s) salvas. O Word foi atualizado diretamente no Drive.`
          : `${quantidadeSalva} foto(s) salvas, mas o Word não foi sincronizado. Use “Atualizar Word” para tentar novamente.`);
      }
    } catch (error) {
      console.error("Erro ao salvar seleção de fotos:", error);

      if (selecaoAnteriorExcluida) {
        alert(
          `O salvamento não foi concluído.\n\n` +
            `${quantidadeSalva} foto(s) foram salvas antes do erro.\n\n` +
            `A seleção anterior foi limpa e o salvamento ficou incompleto. Confira a conexão e clique em "Salvar seleção" novamente.\n\n` +
            `${error.message || error}`
        );
      } else {
        alert(
          `Não foi possível salvar a seleção de fotos.\n\n${error.message || error}`
        );
      }
    } finally {
      setSalvandoSelecao(false);
    }
  }

  // =====================================================
  // URLS DAS IMAGENS
  // =====================================================

  function obterUrlsImagem(arquivo) {
    if (!arquivo?.id) return [];

    const id = encodeURIComponent(arquivo.id);
    const urlsFornecidasPeloDrive = [
      arquivo.thumbnailUrl,
      arquivo.thumbnail_url,
      arquivo.thumbnailLink,
      arquivo.thumbnail_link,
      arquivo.thumbnail,
      arquivo.imageUrl,
      arquivo.image_url,
      arquivo.imagemUrl,
      arquivo.urlImagem,
      arquivo.urlMiniatura,
      arquivo.miniaturaUrl,
      arquivo.webContentLink,
      arquivo.downloadUrl,
      arquivo.download_url,
      arquivo.url,
    ].filter((url) => typeof url === "string" && /^https?:\/\//i.test(url));

    return [...new Set([
      ...urlsFornecidasPeloDrive,
      `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
      `https://drive.google.com/uc?export=view&id=${id}`,
      `https://lh3.googleusercontent.com/d/${id}`,
      `https://drive.google.com/thumbnail?id=${id}&sz=w600`,
    ])];
  }

  function obterUrlImagem(arquivo) {
    return obterUrlsImagem(arquivo)[0] || "";
  }

  async function carregarImagemPeloAppsScript(arquivo) {
    const arquivoId = String(arquivo?.id || "");
    const drivePastaId = String(arquivo?._drive_pasta_id || "");
    const numeroMedicao = String(arquivo?._medicao || "");
    const tamanho = arquivo?._tamanhoImagem === "original" ? "original" : "miniatura";

    if (!arquivoId || !drivePastaId || !numeroMedicao) {
      throw new Error("Faltam os dados da pasta e da medição para consultar a imagem.");
    }

    const chave = `${drivePastaId}:${numeroMedicao}:${arquivoId}:${tamanho}`;
    const cache = cacheImagensRef.current;
    if (cache.has(chave)) return cache.get(chave);

    const parametros = new URLSearchParams({
      acao: "imagem",
      arquivo_id: arquivoId,
      drive_pasta_id: drivePastaId,
      medicao: numeroMedicao,
      tamanho,
    });
    const requisicao = fetch(`${GOOGLE_DRIVE_SCRIPT_URL}?${parametros.toString()}`)
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(`Erro HTTP ${resposta.status}`);
        const dados = await resposta.json();
        if (!dados.ok || !dados.base64) {
          throw new Error(dados.erro || "O Apps Script não retornou o conteúdo da imagem.");
        }
        return `data:${dados.tipo || "image/jpeg"};base64,${dados.base64}`;
      })
      .catch((erro) => {
        cache.delete(chave);
        throw erro;
      });

    cache.set(chave, requisicao);
    if (cache.size > 24) cache.delete(cache.keys().next().value);
    return requisicao;
  }

  // Se a URL da imagem falhar, tenta a próxima alternativa.
  function tentarUrlAlternativaImagem(evento, arquivo) {
    const imagem = evento.currentTarget;
    const urls = obterUrlsImagem(arquivo);

    const indiceAtual = Number(imagem.dataset.tentativa || 0);
    const proximoIndice = indiceAtual + 1;

    if (proximoIndice < urls.length) {
      imagem.dataset.tentativa = String(proximoIndice);
      imagem.src = urls[proximoIndice];
      return;
    }

    if (imagem.dataset.proxyTentada === "true") {
      imagem.onerror = null;
      imagem.style.objectFit = "contain";
      imagem.alt = "Não foi possível carregar esta foto pelo Google Drive.";
      return;
    }

    imagem.dataset.proxyTentada = "true";
    carregarImagemPeloAppsScript(arquivo)
      .then((dataUrl) => {
        if (imagem.isConnected) imagem.src = dataUrl;
      })
      .catch((erro) => {
        console.error("Falha ao carregar a imagem pelo Apps Script:", arquivo?.id, erro);
        if (!imagem.isConnected) return;
        imagem.onerror = null;
        imagem.style.objectFit = "contain";
        imagem.alt = "Não foi possível carregar esta foto pelo Google Drive.";
      });
  }

  function abrirFotoAmpliada(arquivo, url) {
    const foto = { ...arquivo, url, _tamanhoImagem: "original", _carregandoOriginal: true };
    setFotoAmpliada(foto);

    // Mostra a miniatura imediatamente e busca o original em segundo plano.
    // O cache de promessas evita repetir a mesma chamada ao Apps Script.
    carregarImagemPeloAppsScript(foto)
      .then((dataUrl) => {
        setFotoAmpliada((atual) =>
          atual?.id === foto.id
            ? { ...atual, url: dataUrl, _carregandoOriginal: false }
            : atual
        );
      })
      .catch((erro) => {
        console.warn("Não foi possível carregar a foto original; mantendo a prévia disponível.", erro);
        setFotoAmpliada((atual) =>
          atual?.id === foto.id
            ? { ...atual, _carregandoOriginal: false }
            : atual
        );
      });
  }

  async function carregarWordSalvoDoDrive(item, frentesDaMedicao) {
    setWordAtualizado(null);
    setErroWord("");
    setSelecaoFotoAlterada(false);
    if (item?.status === "fechada") return;
    const pastaFotosId = (frentesDaMedicao || []).map((frente) => frente.drive_pasta_id).find(Boolean);
    if (!pastaFotosId) return;
    try {
      const parametros = new URLSearchParams({
        acao: "buscar_relatorio_word",
        drive_pasta_id: pastaFotosId,
        contrato_numero: String(item.contratos?.numero || item.contrato_id || ""),
        medicao: String(item.numero || ""),
      });
      const respostaDrive = await fetch(`${GOOGLE_DRIVE_SCRIPT_URL}?${parametros.toString()}`);
      const resultado = await respostaDrive.json();
      if (!respostaDrive.ok || !resultado.ok) throw new Error(resultado.erro || "Não foi possível consultar o Word no Drive.");
      if (resultado.encontrado) {
        setWordAtualizado({
          docx_drive_file_id: resultado.file_id,
          docx_drive_url: resultado.file_url,
          sincronizacao_drive: "sincronizado",
          updated_at: new Date().toISOString(),
        });
      }
    } catch (erro) {
      console.warn("Não foi possível localizar o Word no Drive:", erro);
      setErroWord("Não foi possível consultar a cópia do Word no Drive.");
    }
  }
  // =====================================================
  // URL DO ARQUIVO
  // =====================================================

  function obterUrlArquivo(arquivo) {
    if (!arquivo?.id) return "";

    return `https://drive.google.com/file/d/${encodeURIComponent(
      arquivo.id
    )}/view`;
  }

  async function sincronizarRelatorioWord({ silencioso = false, aposSalvarSelecao = false } = {}) {
    if (!medicaoFotosAtual?.id || salvandoWord || (selecaoFotoAlterada && !aposSalvarSelecao)) return false;
    if (medicaoFotosAtual.status === "fechada") {
      setErroWord("Esta medição está fechada; o relatório final existente não será recriado.");
      return false;
    }
    setSalvandoWord(true);
    setErroWord("");
    setProgressoWord("Preparando o arquivo Word...");
    const medicaoId = Number(medicaoFotosAtual.id);

    try {
      const { data: fotosSalvas, error: erroFotosSalvas } = await supabase
        .from("relatorio_fotos")
        .select("frente_id,drive_arquivo_id,nome_arquivo,legenda,ordem")
        .eq("medicao_id", medicaoId)
        .order("ordem", { ascending: true });
      if (erroFotosSalvas) throw erroFotosSalvas;
      if (!fotosSalvas?.length) throw new Error("Salve primeiro ao menos uma foto selecionada.");

      const frenteIds = [...new Set(fotosSalvas.map((foto) => Number(foto.frente_id)))];
      const { data: frentesWord, error: erroFrentesWord } = await supabase
        .from("frentes")
        .select("id,nome,ordem,drive_pasta_id")
        .in("id", frenteIds);
      if (erroFrentesWord) throw erroFrentesWord;

      const arquivoPorId = new Map(
        Object.values(fotosPorFrente).flatMap((item) => item.fotos || [])
          .map((arquivo) => [String(arquivo.id), arquivo])
      );
      const frentePorId = new Map((frentesWord || []).map((frente) => [Number(frente.id), frente]));
      const fotosWord = fotosSalvas.map((foto) => {
        const frente = frentePorId.get(Number(foto.frente_id));
        const id = String(foto.drive_arquivo_id || "");
        const arquivoExistente = arquivoPorId.get(id) || {};
        const pastaId = String(arquivoExistente._drive_pasta_id || frente?.drive_pasta_id || "");
        if (!pastaId) throw new Error(`A frente ${frente?.nome || "selecionada"} não tem uma pasta Fotos configurada no Drive.`);
        return {
          ...foto,
          _arquivoDrive: {
            ...arquivoExistente,
            id,
            nome: foto.nome_arquivo || arquivoExistente.nome || id,
            _drive_pasta_id: pastaId,
            _medicao: String(medicaoFotosAtual.numero || ""),
            _tamanhoImagem: "original",
          },
        };
      });

      const { gerarRelatorioWord } = await import("../../utils/gerarRelatorioWord");
      const arquivoWord = await gerarRelatorioWord({
        contratoNumero: medicaoFotosAtual.contratos?.numero || medicaoFotosAtual.contrato_id || "-",
        contratoNome: medicaoFotosAtual.contratos?.nome || "",
        numeroMedicao: medicaoFotosAtual.numero || "-",
        frentes: frentesWord || [],
        fotos: fotosWord,
        logo: LOGO_LA_FORTE,
        simbolo: SIMBOLO_LA_FORTE,
        carregarImagem: (foto) => carregarImagemPeloAppsScript(foto._arquivoDrive),
        progresso: (atual, total) => setProgressoWord(`Preparando foto ${atual} de ${total} para o Word...`),
      });
      if (arquivoWord.size > 32 * 1024 * 1024) {
        throw new Error("O Word ultrapassou o limite seguro de envio direto ao Drive. Reduza a quantidade de fotos selecionadas e tente novamente.");
      }

      setProgressoWord("Sincronizando o Word com o Google Drive...");
      const pastaFotosId = fotosWord[0]?._arquivoDrive?._drive_pasta_id;
      const bytes = new Uint8Array(await arquivoWord.arrayBuffer());
      let binario = "";
      const tamanhoBloco = 0x8000;
      for (let inicio = 0; inicio < bytes.length; inicio += tamanhoBloco) {
        binario += String.fromCharCode(...bytes.subarray(inicio, inicio + tamanhoBloco));
      }
      const respostaDrive = await fetch(GOOGLE_DRIVE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          acao: "salvar_relatorio_word",
          drive_pasta_id: pastaFotosId,
          contrato_numero: String(medicaoFotosAtual.contratos?.numero || medicaoFotosAtual.contrato_id || ""),
          medicao_numero: String(medicaoFotosAtual.numero || ""),
          arquivo_base64: btoa(binario),
          drive_file_id: wordAtualizado?.docx_drive_file_id || "",
        }),
      });
      const textoDrive = await respostaDrive.text();
      let resultadoDrive;
      try { resultadoDrive = JSON.parse(textoDrive); }
      catch { throw new Error("O Apps Script não devolveu uma resposta válida. Confira se a versão atual foi publicada."); }
      if (!respostaDrive.ok || !resultadoDrive.ok) {
        throw new Error(resultadoDrive.erro || `Não foi possível sincronizar com o Drive (HTTP ${respostaDrive.status}).`);
      }

      const dadosSincronizados = {
        medicao_id: medicaoId,
        docx_drive_file_id: resultadoDrive.file_id,
        docx_drive_url: resultadoDrive.file_url,
        sincronizacao_drive: "sincronizado",
        updated_at: new Date().toISOString(),
      };
      setWordAtualizado(dadosSincronizados);
      setErroWord("");
      setSelecaoFotoAlterada(false);
      if (!silencioso) alert("Word atualizado diretamente na pasta Relatório fotográfico deste contrato no Drive.");
      return true;
    } catch (erro) {
      console.error("Erro ao salvar/sincronizar o Word:", erro);
      setErroWord(erro.message || "Não foi possível atualizar o Word.");
      if (!silencioso) alert(`Não foi possível atualizar o Word no Drive. Tente novamente.\n\n${erro.message || erro}`);
      return false;
    } finally {
      setSalvandoWord(false);
      setProgressoWord("");
    }
  }
  // Gera um relatório no padrão La Forte usando exclusivamente as fotos
  // persistidas em relatorio_fotos. A impressão do navegador salva em PDF.
  async function gerarRelatorioFotografico() {
    if (!medicaoFotosAtual?.id || gerandoRelatorio) return;
    if (medicaoFotosAtual.status === "fechada") {
      alert("Esta medição está fechada. O relatório final existente foi preservado e não será recriado.");
      return;
    }
    if (selecaoFotoAlterada) {
      alert("Salve a seleção de fotos antes de finalizar o relatório.");
      return;
    }
    if (!wordAtualizado?.docx_drive_file_id || wordAtualizado.sincronizacao_drive !== "sincronizado") {
      alert("Atualize e sincronize primeiro o arquivo Word do relatório.");
      return;
    }

    // Abrir a janela no clique evita bloqueio de popup enquanto consultamos o Supabase.
    const janela = window.open("", "_blank");
    if (!janela) {
      alert("Permita a abertura de pop-ups para gerar o relatório.");
      return;
    }

    setGerandoRelatorio(true);
    janela.document.write("<p style='font:16px Arial;padding:24px'>Preparando relatório…</p>");
    janela.document.close();

    try {
      const medicaoId = Number(medicaoFotosAtual.id);
      const { data: fotosSalvas, error } = await supabase
        .from("relatorio_fotos")
        .select("frente_id, drive_arquivo_id, nome_arquivo, legenda, ordem")
        .eq("medicao_id", medicaoId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      if (!fotosSalvas?.length) {
        janela.close();
        alert("Esta medição ainda não tem fotos salvas para o relatório.");
        return;
      }

      const fotosSemLegenda = fotosSalvas.filter((foto) => !foto.legenda?.trim());
      if (fotosSemLegenda.length > 0) {
        janela.close();
        alert(
          `Preencha a legenda de cada foto selecionada antes de gerar o relatório.\n\nFaltam ${fotosSemLegenda.length} legenda(s).`
        );
        return;
      }

      const frenteIds = [...new Set(fotosSalvas.map((foto) => Number(foto.frente_id)))];
      const { data: frentesRelatorio, error: erroFrentes } = await supabase
        .from("frentes")
        .select("id, nome, ordem")
        .in("id", frenteIds);

      if (erroFrentes) throw erroFrentes;

      const nomesFrentes = new Map(
        (frentesRelatorio || []).map((frente) => [Number(frente.id), frente.nome || "Frente"])
      );
      const escapar = (valor) => String(valor ?? "").replace(/[&<>\"']/g, (caractere) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
      }[caractere]));
      const numeroMedicao = escapar(medicaoFotosAtual.numero || "-");
      const contratoNumero = escapar(medicaoFotosAtual.contratos?.numero || medicaoFotosAtual.contrato_id || "-");
      const fotosDoDrive = Object.values(fotosPorFrente).flatMap((resultado) => resultado.fotos || []);

      const formatosFoto = [
        { tipo: 1, proporcao: 15 / 8.44, largura: 15, altura: 8.44 },
        { tipo: 2, proporcao: 13.29 / 10, largura: 13.29, altura: 10 },
        { tipo: 3, proporcao: 7.53 / 10, largura: 7.53, altura: 10 },
        { tipo: 4, proporcao: 5.62 / 10, largura: 5.62, altura: 10 },
        { tipo: 5, proporcao: 1600 / 600, largura: 17.4, altura: 6.525 },
      ];
      const identificarFormato = (largura, altura) => {
        if (!largura || !altura) return formatosFoto[1];
        const proporcao = largura / altura;
        return formatosFoto.reduce((maisProximo, formato) =>
          Math.abs(Math.log(proporcao / formato.proporcao)) <
            Math.abs(Math.log(proporcao / maisProximo.proporcao))
            ? formato
            : maisProximo
        );
      };
      const medirImagem = (origem) => new Promise((resolve) => {
        const imagem = new Image();
        const timeout = window.setTimeout(() => resolve(null), 5000);
        imagem.onload = () => {
          window.clearTimeout(timeout);
          resolve({ largura: imagem.naturalWidth, altura: imagem.naturalHeight });
        };
        imagem.onerror = () => {
          window.clearTimeout(timeout);
          resolve(null);
        };
        imagem.src = origem;
      });
      const medirFoto = async (arquivo) => {
        const urls = obterUrlsImagem(arquivo);
        for (const url of urls.slice(0, 2)) {
          const dimensoes = await medirImagem(url);
          if (dimensoes) return dimensoes;
        }
        try {
          const dataUrl = await carregarImagemPeloAppsScript(arquivo);
          return await medirImagem(dataUrl);
        } catch (erro) {
          console.warn("Não foi possível medir a foto; será aplicado o formato padrão.", erro);
          return null;
        }
      };

      const arquivoPorId = new Map(fotosDoDrive.map((arquivo) => [String(arquivo.id), arquivo]));
      const dimensoesPorId = new Map();
      let proximoIndiceMedicao = 0;
      const medirProximaFoto = async () => {
        while (proximoIndiceMedicao < fotosSalvas.length) {
          const indice = proximoIndiceMedicao++;
          const foto = fotosSalvas[indice];
          const id = String(foto.drive_arquivo_id || "");
          const arquivo = arquivoPorId.get(id) || {
            id,
            _medicao: medicaoFotosAtual.numero || "",
          };
          dimensoesPorId.set(id, await medirFoto(arquivo));
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(6, fotosSalvas.length) }, () => medirProximaFoto())
      );

      const renderizarFoto = (foto, formato) => {
        const idOriginal = String(foto.drive_arquivo_id || "");
        const registroDrive = arquivoPorId.get(idOriginal);
        const arquivoImagem = registroDrive || { id: idOriginal };
        const urls = obterUrlsImagem(arquivoImagem);
        const url = escapar(urls[0] || "");
        const urlsJson = escapar(JSON.stringify(urls));
        const idHtml = escapar(idOriginal);
        const pastaHtml = escapar(arquivoImagem._drive_pasta_id || "");
        const medicaoHtml = escapar(arquivoImagem._medicao || medicaoFotosAtual.numero || "");
        const legenda = escapar(foto.legenda || "");
        return `<figure class="foto-item" style="width:${formato.largura}cm;height:${formato.altura}cm"><img src="${url}" alt="${legenda}" data-file-id="${idHtml}" data-drive-folder-id="${pastaHtml}" data-medicao="${medicaoHtml}" data-urls="${urlsJson}" data-url-index="0" onerror="const u=JSON.parse(this.dataset.urls||'[]');const n=Number(this.dataset.urlIndex||0)+1;if(n<u.length){this.dataset.urlIndex=String(n);this.src=u[n]}else{window.carregarImagemViaApi(this)}"></figure>`;
      };

      const frentesOrdenadas = (frentesRelatorio || [])
        .slice()
        .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
      const paginas = [];
      let primeiraPagina = true;
      frentesOrdenadas.forEach((frente) => {
        const fotosDaFrente = fotosSalvas
          .filter((foto) => Number(foto.frente_id) === Number(frente.id))
          .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
          .map((foto) => {
            const id = String(foto.drive_arquivo_id || "");
            const dimensoes = dimensoesPorId.get(id);
            return { foto, formato: identificarFormato(dimensoes?.largura, dimensoes?.altura) };
          });

        const primeiraFrenteDoRelatorio = primeiraPagina;
        if (primeiraPagina && fotosDaFrente.length) {
          const fotoUnica = fotosDaFrente.shift();
          const tituloFrenteInicial = `<h2 class="frente-titulo">${escapar(nomesFrentes.get(Number(frente.id)) || "Frente")}</h2>`;
          const metadadosIniciais = `<section class="identificacao"><h1>RELATÓRIO FOTOGRÁFICO</h1><p>CONTRATO: ${contratoNumero}</p><p>MEDIÇÃO ${numeroMedicao}</p></section>`;
          const legendaInicial = String(fotoUnica.foto.legenda || "").trim();
          const htmlLegendaInicial = legendaInicial
            ? `<div class="legendas-centrais"><p>${escapar(legendaInicial)}</p></div>`
            : "";
          paginas.push(`<section class="pagina primeira-pagina"><div class="marca"><img class="simbolo" src="${SIMBOLO_LA_FORTE}" alt=""><img class="logotipo" src="${LOGO_LA_FORTE}" alt="La Forte Engenharia"></div>${metadadosIniciais}${tituloFrenteInicial}<main class="fotos"><div class="linha-fotos">${renderizarFoto(fotoUnica.foto, fotoUnica.formato)}</div>${htmlLegendaInicial}</main></section>`);
          primeiraPagina = false;
        }

        const linhas = [];
        let linhaAtual = [];
        let larguraLinha = 0;
        fotosDaFrente.forEach((item) => {
          const precisaLinhaUnica = item.formato.tipo === 1 || item.formato.tipo === 2;
          const linhaAtualUnica = linhaAtual.some(({ formato }) => formato.tipo === 1 || formato.tipo === 2);
          const larguraNecessaria = item.formato.largura + (linhaAtual.length ? 1.8 : 0);
          if (linhaAtual.length && (precisaLinhaUnica || linhaAtualUnica || larguraLinha + larguraNecessaria > 19.4 + 0.01)) {
            linhas.push(linhaAtual);
            linhaAtual = [];
            larguraLinha = 0;
          }
          const espaco = linhaAtual.length ? 1.8 : 0;
          linhaAtual.push(item);
          larguraLinha += item.formato.largura + espaco;
        });
        if (linhaAtual.length) linhas.push(linhaAtual);

        const paginaComSomentePanoramicas = linhas.length > 0 && linhas.every((linha) =>
          linha.every((item) => item.formato.tipo === 5)
        );
        const limiteLinhasPagina = paginaComSomentePanoramicas ? 3 : 2;

        for (let inicioLinha = 0; inicioLinha < linhas.length; inicioLinha += limiteLinhasPagina) {
          const linhasDaPagina = linhas.slice(inicioLinha, inicioLinha + limiteLinhasPagina);
          const fotosDaPagina = linhasDaPagina.flat();
          const legendasUnicas = [];
          const chavesLegendas = new Set();
          fotosDaPagina.forEach(({ foto }) => {
            const texto = String(foto.legenda || "").trim();
            const chave = texto.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
            if (texto && !chavesLegendas.has(chave)) {
              chavesLegendas.add(chave);
              legendasUnicas.push(texto);
            }
          });
          const legendasFormatadas = legendasUnicas.map((legenda, indice) => {
            const texto = String(legenda || "").trim();
            const textoComInicial = indice === 0
              ? texto
              : texto.charAt(0).toLocaleLowerCase("pt-BR") + texto.slice(1);
            return escapar(textoComInicial);
          });
          const textoLegendas = legendasFormatadas.length < 2
            ? (legendasFormatadas[0] || "")
            : legendasFormatadas.length === 2
              ? `${legendasFormatadas[0]} e ${legendasFormatadas[1]}`
              : `${legendasFormatadas.slice(0, -1).join(", ")} e ${legendasFormatadas[legendasFormatadas.length - 1]}`;
          const htmlLegendas = textoLegendas
            ? `<div class="legendas-centrais"><p>${textoLegendas}</p></div>`
            : "";
          const htmlLinhas = linhasDaPagina.map((linha, indice) => {
            const htmlLinha = `<div class="linha-fotos">${linha.map(({ foto, formato }) => renderizarFoto(foto, formato)).join("")}</div>`;
            return indice === 0 ? htmlLinha + htmlLegendas : htmlLinha;
          }).join("");
          const metadados = primeiraPagina
            ? `<section class="identificacao"><h1>RELATÓRIO FOTOGRÁFICO</h1><p>CONTRATO: ${contratoNumero}</p><p>MEDIÇÃO ${numeroMedicao}</p></section>`
            : "";
          const tituloFrente = inicioLinha === 0 && !primeiraFrenteDoRelatorio
            ? `<h2 class="frente-titulo">${escapar(nomesFrentes.get(Number(frente.id)) || "Frente")}</h2>`
            : "";
          paginas.push(`<section class="pagina"><div class="marca"><img class="simbolo" src="${SIMBOLO_LA_FORTE}" alt=""><img class="logotipo" src="${LOGO_LA_FORTE}" alt="La Forte Engenharia"></div>${metadados}${tituloFrente}<main class="fotos">${htmlLinhas}</main></section>`);
          primeiraPagina = false;
        }
      });

      janela.document.open();
      const endpointImagens = escapar(GOOGLE_DRIVE_SCRIPT_URL);
      janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório fotográfico — Medição ${numeroMedicao}</title><script>window.carregarImagemViaApi=function(img){if(img.dataset.proxyTentada)return;img.dataset.proxyTentada='1';const p=new URLSearchParams({acao:'imagem',arquivo_id:img.dataset.fileId,drive_pasta_id:img.dataset.driveFolderId,medicao:img.dataset.medicao,tamanho:'miniatura'});fetch('${endpointImagens}?'+p.toString()).then(r=>r.json()).then(d=>{if(!d.ok||!d.base64)throw new Error(d.erro||'Imagem indisponível');img.src='data:'+(d.tipo||'image/jpeg')+';base64,'+d.base64}).catch(()=>{img.onerror=null;img.alt='Imagem indisponível. Verifique o acesso ao Google Drive.'})};<\/script><style>
        *{box-sizing:border-box}html,body{margin:0;color:#111;font-family:Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;z-index:2;padding:10px;text-align:center;background:#f1f5f9;border-bottom:1px solid #cbd5e1}.toolbar button{padding:10px 18px;border:0;border-radius:6px;background:#087f8c;color:#fff;font-weight:700;font-size:14px;cursor:pointer}.pagina{width:210mm;height:297mm;min-height:297mm;padding:6mm 8mm 8mm;margin:0 auto;page-break-after:always;break-after:page;break-inside:avoid;page-break-inside:avoid;position:relative;overflow:hidden}.pagina.primeira-pagina{padding-top:15mm}.pagina:last-child{page-break-after:auto;break-after:auto}.marca{height:20mm;display:flex;align-items:center;justify-content:center;gap:5mm;margin-bottom:10mm}.pagina.primeira-pagina .marca{margin-bottom:20mm}.simbolo{width:20mm;height:20mm;object-fit:contain}.logotipo{width:145mm;height:auto;object-fit:contain}.identificacao{text-align:left;margin:0 0 20mm}.identificacao h1{font-size:12pt;font-weight:400;margin:0 0 2mm}.identificacao p{font-size:11pt;font-weight:400;margin:0 0 2mm}.frente-titulo{font-size:12pt;font-weight:700;margin:3mm 0 10mm}.pagina.primeira-pagina .frente-titulo{margin-bottom:18mm}.fotos{display:flex;flex-direction:column;gap:10mm;align-items:center;justify-content:flex-start}.linha-fotos{width:100%;display:flex;column-gap:18mm;row-gap:10mm;align-items:center;justify-content:center;break-inside:avoid;page-break-inside:avoid}.foto-item{flex:none;margin:0;break-inside:avoid;text-align:center;border:0;padding:0;display:flex;align-items:center;justify-content:center;overflow:hidden}.foto-item img{display:block;width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;border:1pt solid #111;box-sizing:border-box}.legendas-centrais{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;column-gap:18mm;row-gap:3mm;text-align:center;align-self:stretch;padding:4mm 3mm 3mm;font-size:9pt;font-weight:700;line-height:1.2;overflow-wrap:anywhere;break-inside:avoid;page-break-inside:avoid}.legendas-centrais p{flex:0 1 auto;max-width:100%;margin:0}@page{size:A4 portrait;margin:0}@media screen{body{background:#e5e7eb}.pagina{background:#fff;margin:16px auto;box-shadow:0 2px 14px #0002}}@media print{.toolbar{display:none!important}.pagina{margin:0}.foto-item img{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body><div class="toolbar"><button type="button" onclick="window.print()">Imprimir / Salvar como PDF</button></div>${paginas.join("")}<script>window.addEventListener('load',()=>{const imgs=[...document.images];Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;setTimeout(r,8000)}))).then(()=>setTimeout(()=>window.print(),300));});<\/script></body></html>`);
      janela.document.close();
      janela.focus();
    } catch (error) {
      console.error("Erro ao gerar relatório fotográfico:", error);
      janela.close();
      alert(`Não foi possível gerar o relatório fotográfico.\n\n${error.message || error}`);
    } finally {
      setGerandoRelatorio(false);
    }
  }

  // =====================================================
  // FECHAR MODAL DE FOTOS
  // =====================================================

  function fecharModalFotos() {
    setModalFotosAberto(false);
    setMedicaoFotosAtual(null);
    setFotosPorFrente({});
    setFotosSelecionadas({});
    setErroFotos("");
    setFotoAmpliada(null);
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="medicoes-page">
      {/* CABEÇALHO */}
      <div className="medicoes-topo">
        <div>
          <h1>Medições</h1>
        </div>

        <button className="nova-medicao-btn" onClick={novaMedicao}>
          + Nova Medição
        </button>
      </div>

      {/* TABELA */}
      <div className="medicoes-tabela-container">
        <table className="medicoes-tabela">
          <thead>
            <tr>
              <th>Medição</th>
              <th>Contrato</th>
              <th>Obra</th>
              <th>Período</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {carregando ? (
              <tr>
                <td colSpan="6" className="medicoes-vazio">
                  Carregando medições...
                </td>
              </tr>
            ) : medicoes.length === 0 ? (
              <tr>
                <td colSpan="6" className="medicoes-vazio">
                  Nenhuma medição cadastrada.
                </td>
              </tr>
            ) : (
              medicoes.map((item) => (
                <tr key={item.id}>
                  <td>Nº {item.numero}</td>
                  <td>{item.contratos?.numero || "-"}</td>
                  <td>{item.contratos?.nome || "-"}</td>
                  <td>
                    {formatarData(item.data_inicio)}
                    {" até "}
                    {formatarData(item.data_fim)}
                  </td>
                  <td>{mostrarStatus(item.status)}</td>
                  <td>
                    <div className="medicoes-acoes">
                      <button
                        type="button"
                        onClick={() => abrirFotosMedicao(item)}
                      >
                        📷 Ver fotos
                      </button>

                      <button
                        type="button"
                        onClick={() => editarMedicao(item)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => excluirMedicao(item.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL NOVA / EDITAR MEDIÇÃO */}
      <Modal
        aberto={modalAberto}
        titulo={medicao.id ? "Editar Medição" : "Nova Medição"}
        onClose={() => {
          if (!salvando) setModalAberto(false);
        }}
      >
        <form
          className="form-medicao"
          onSubmit={salvarMedicao}
          style={{
            maxHeight: "calc(100vh - 190px)",
            overflowY: "auto",
            overscrollBehavior: "contain",
            paddingRight: "8px",
          }}
        >
          <div className="campo-medicao">
            <label>Contrato</label>
            <select
              value={medicao.contrato_id}
              onChange={(e) => alterarContrato(e.target.value)}
              disabled={salvando || Boolean(contratoIdContexto)}
            >
              <option value="">Selecione o contrato</option>
              {(contratoIdContexto
                ? contratos.filter((item) => Number(item.id) === contratoIdContexto)
                : contratos
              ).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.numero} - {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="linha-medicao">
            <div className="campo-medicao">
              <label>Nº da Medição</label>
              <input
                type="number"
                min="1"
                value={medicao.numero}
                onChange={(e) =>
                  setMedicao({ ...medicao, numero: e.target.value })
                }
                disabled={salvando}
              />
            </div>

            <div className="campo-medicao">
              <label>Status</label>
              <select
                value={medicao.status}
                onChange={(e) =>
                  setMedicao({ ...medicao, status: e.target.value })
                }
                disabled={salvando}
              >
                <option value="em_andamento">Em andamento</option>
                <option value="fechada">Fechada</option>
              </select>
            </div>
          </div>

          <div className="linha-medicao">
            <div className="campo-medicao">
              <label>Data inicial</label>
              <input
                type="date"
                value={medicao.data_inicio}
                onChange={(e) =>
                  setMedicao({ ...medicao, data_inicio: e.target.value })
                }
                disabled={salvando}
              />
            </div>

            <div className="campo-medicao">
              <label>Data final</label>
              <input
                type="date"
                value={medicao.data_fim}
                onChange={(e) =>
                  setMedicao({ ...medicao, data_fim: e.target.value })
                }
                disabled={salvando}
              />
            </div>
          </div>

          {/* FRENTES */}
          <div className="campo-medicao">
            <label>Frentes desta medição</label>

            {carregandoFrentes ? (
              <div style={{ padding: "14px", textAlign: "center" }}>
                Carregando frentes...
              </div>
            ) : !medicao.contrato_id ? (
              <div
                style={{
                  padding: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  color: "#64748b",
                }}
              >
                Selecione um contrato para visualizar as frentes.
              </div>
            ) : frentesOrdenadas.length === 0 ? (
              <div
                style={{
                  padding: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  color: "#64748b",
                }}
              >
                Este contrato não possui frentes cadastradas.
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid #d7dce5",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <strong>
                    {frentesSelecionadas.length} de {frentesOrdenadas.length}{" "}
                    selecionada(s)
                  </strong>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={selecionarTodasFrentes}
                      disabled={salvando}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Selecionar todas
                    </button>

                    <button
                      type="button"
                      onClick={desmarcarTodasFrentes}
                      disabled={salvando}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Desmarcar todas
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {frentesOrdenadas.map((frente) => {
                    const selecionada = frentesSelecionadas.includes(
                      Number(frente.id)
                    );
                    const arquivada =
                      (frente.status || "ativo") === "arquivado";

                    return (
                      <label
                        key={frente.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          border: selecionada
                            ? "1px solid #2563eb"
                            : "1px solid #e2e8f0",
                          borderRadius: "7px",
                          background: selecionada ? "#eff6ff" : "#fff",
                          cursor: salvando ? "default" : "pointer",
                          opacity: arquivada ? 0.7 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selecionada}
                          onChange={() => alternarFrente(frente.id)}
                          disabled={salvando}
                        />

                        <span
                          style={{
                            flex: 1,
                            fontWeight: selecionada ? 600 : 500,
                          }}
                        >
                          {frente.nome}
                        </span>

                        {arquivada && (
                          <span style={{ fontSize: "12px", color: "#b45309" }}>
                            Arquivada
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* OBSERVAÇÃO */}
          <div className="campo-medicao">
            <label>Observação</label>
            <textarea
              value={medicao.observacao}
              onChange={(e) =>
                setMedicao({ ...medicao, observacao: e.target.value })
              }
              placeholder="Observações da medição..."
              rows="4"
              disabled={salvando}
            />
          </div>

          {/* BOTÕES */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "10px",
              padding: "10px 0",
              position: "sticky",
              bottom: 0,
              background: "#fff",
              zIndex: 1,
            }}
          >
            <button
              type="button"
              onClick={() => setModalAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </button>

            <button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DE FOTOS */}
      {modalFotosAberto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(1200px, 96vw)",
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* CABEÇALHO */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 22px",
                borderBottom: "1px solid #e5e7eb",
                gap: "15px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "22px" }}>
                  Fotos — Medição {medicaoFotosAtual?.numero}
                </h2>

                <div
                  style={{
                    marginTop: "6px",
                    color: "#64748b",
                    fontSize: "14px",
                  }}
                >
                  {totalFotosSelecionadas} de {totalFotos} fotos selecionadas
                </div>
              </div>

              <button
                type="button"
                onClick={fecharModalFotos}
                disabled={salvandoSelecao}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "26px",
                  cursor: salvandoSelecao ? "default" : "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* BARRA DE SELEÇÃO */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
                padding: "12px 22px",
                background: "#f8fafc",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontWeight: 700, color: "#334155" }}>
                {totalFotosSelecionadas} foto(s) selecionada(s)
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={selecionarTodasFotos}
                  disabled={
                    carregandoFotos ||
                    carregandoSelecao ||
                    salvandoSelecao ||
                    totalFotos === 0
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "7px",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ☑ Selecionar todas
                </button>

                <button
                  type="button"
                  onClick={desmarcarTodasFotos}
                  disabled={
                    carregandoFotos ||
                    carregandoSelecao ||
                    salvandoSelecao ||
                    totalFotosSelecionadas === 0
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "7px",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ☐ Desmarcar todas
                </button>

                <button
                  type="button"
                  onClick={salvarSelecaoFotos}
                  disabled={
                    carregandoFotos ||
                    carregandoSelecao ||
                    salvandoSelecao
                  }
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #2563eb",
                    borderRadius: "7px",
                    background: "#2563eb",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {salvandoSelecao ? "Salvando..." : "💾 Salvar seleção"}
                </button>
                {medicaoFotosAtual?.status !== "fechada" && <>
                  <button
                    type="button"
                    onClick={() => selecaoFotoAlterada ? salvarSelecaoFotos() : sincronizarRelatorioWord()}
                    disabled={salvandoWord || salvandoSelecao || carregandoSelecao || totalFotosSelecionadas === 0}
                    style={{ padding: "8px 12px", border: "1px solid #7c3aed", borderRadius: "7px", background: "#7c3aed", color: "#fff", cursor: salvandoWord ? "wait" : "pointer", fontWeight: 700 }}
                  >
                    {salvandoWord ? "Atualizando Word..." : selecaoFotoAlterada ? "💾 Salvar + atualizar Word" : "📝 Atualizar Word"}
                  </button>
                  <button
                    type="button"
                    onClick={gerarRelatorioFotografico}
                    disabled={gerandoRelatorio || carregandoSelecao || salvandoSelecao || salvandoWord || selecaoFotoAlterada || wordAtualizado?.sincronizacao_drive !== "sincronizado"}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #0f766e",
                      borderRadius: "7px",
                      background: "#0f766e",
                      color: "#fff",
                      cursor: gerandoRelatorio ? "wait" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {gerandoRelatorio ? "Gerando..." : "📄 Finalizar / gerar PDF"}
                  </button>
                </>}
              </div>
            </div>

            <div style={{ padding: "9px 22px", background: "#fff", borderBottom: "1px solid #e5e7eb", color: erroWord ? "#b91c1c" : "#475569", fontSize: "14px" }}>
              {medicaoFotosAtual?.status === "fechada"
                ? "Medição fechada: o relatório final existente foi preservado e não será recriado."
                : salvandoWord
                  ? progressoWord
                  : erroWord || (wordAtualizado?.sincronizacao_drive === "sincronizado" ? "Word atualizado diretamente no Google Drive." : "O Word será criado/atualizado no Google Drive ao salvar a seleção de fotos.")}
              {wordAtualizado?.docx_drive_url && <a href={wordAtualizado.docx_drive_url} target="_blank" rel="noreferrer" style={{ marginLeft: 12 }}>Abrir cópia no Drive</a>}
            </div>

            {/* CONTEÚDO */}
            <div style={{ overflowY: "auto", padding: "22px" }}>
              {/* INFORMAÇÕES */}
              <div
                style={{
                  background: "#f1f5f9",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontWeight: 700, color: "#475569" }}>
                  Contrato: {medicaoFotosAtual?.contratos?.numero || "-"}
                </div>

                <div style={{ marginTop: "4px", color: "#64748b" }}>
                  {medicaoFotosAtual?.contratos?.nome || ""}
                </div>

                <div style={{ marginTop: "8px", color: "#64748b" }}>
                  Medição Nº {medicaoFotosAtual?.numero}
                </div>
              </div>

              {/* CARREGANDO DRIVE */}
              {carregandoFotos && (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: 600 }}>
                    Consultando Google Drive...
                  </div>

                  <div style={{ marginTop: "8px", fontSize: "14px" }}>
                    Procurando as fotos da Medição {medicaoFotosAtual?.numero}.
                  </div>
                </div>
              )}

              {/* CARREGANDO SELEÇÃO */}
              {!carregandoFotos && carregandoSelecao && (
                <div
                  style={{
                    padding: "15px",
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Carregando seleção anterior...
                </div>
              )}

              {/* ERRO GERAL */}
              {!carregandoFotos && erroFotos && (
                <div
                  style={{
                    padding: "14px",
                    border: "1px solid #fdba74",
                    background: "#fff7ed",
                    color: "#c2410c",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    whiteSpace: "pre-line",
                  }}
                >
                  {erroFotos}
                </div>
              )}

              {/* RESULTADOS POR FRENTE */}
              {!carregandoFotos && Object.keys(fotosPorFrente).length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "28px",
                  }}
                >
                  {Object.values(fotosPorFrente).map((resultado) => {
                    const fotos = resultado.fotos || [];
                    const videos = resultado.videos || [];
                    const quantidade = resultado.quantidade || {};

                    const fotosDaFrenteSelecionadas = fotos.filter((arquivo) =>
                      fotoEstaSelecionada(arquivo)
                    ).length;

                    const todasDaFrenteSelecionadas =
                      fotos.length > 0 &&
                      fotos.every((arquivo) => fotoEstaSelecionada(arquivo));

                    return (
                      <section
                        key={resultado.frente.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "10px",
                          padding: "16px",
                        }}
                      >
                        {/* CABEÇALHO FRENTE */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                            marginBottom: "14px",
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                margin: 0,
                                fontSize: "19px",
                                color: "#475569",
                              }}
                            >
                              {resultado.frente.nome}
                            </h3>

                            {resultado.pastaMedicao && (
                              <div
                                style={{
                                  marginTop: "5px",
                                  fontSize: "13px",
                                  color: "#64748b",
                                }}
                              >
                                Pasta: {resultado.pastaMedicao.nome}
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ fontSize: "13px", color: "#64748b" }}>
                              {quantidade.fotos || fotos.length || 0} fotos •{" "}
                              {quantidade.videos || videos.length || 0} vídeos
                            </div>

                            {fotos.length > 0 && (
                              <button
                                type="button"
                                onClick={() => selecionarFotosDaFrente(resultado)}
                                disabled={salvandoSelecao}
                                style={{
                                  padding: "6px 10px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  background: "#fff",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                {todasDaFrenteSelecionadas
                                  ? "☐ Desmarcar fotos"
                                  : "☑ Selecionar fotos"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* CONTADOR DA FRENTE */}
                        {fotos.length > 0 && (
                          <div
                            style={{
                              marginBottom: "12px",
                              fontSize: "13px",
                              color: "#64748b",
                            }}
                          >
                            {fotosDaFrenteSelecionadas} de {fotos.length} fotos
                            desta frente selecionadas
                          </div>
                        )}

                        {/* ERRO DA FRENTE */}
                        {!resultado.ok && (
                          <div
                            style={{
                              padding: "12px",
                              background: "#fff7ed",
                              border: "1px solid #fdba74",
                              color: "#c2410c",
                              borderRadius: "8px",
                              marginBottom: "10px",
                            }}
                          >
                            {resultado.erro}
                          </div>
                        )}

                        {/* PASTA NÃO ENCONTRADA */}
                        {resultado.ok && resultado.encontrada === false && (
                          <div
                            style={{
                              padding: "12px",
                              background: "#f8fafc",
                              border: "1px solid #cbd5e1",
                              color: "#475569",
                              borderRadius: "8px",
                            }}
                          >
                            A pasta da Medição {medicaoFotosAtual?.numero} não
                            foi encontrada dentro da pasta de fotos desta
                            frente.
                          </div>
                        )}

                        {/* FOTOS */}
                        {resultado.ok && fotos.length > 0 && (
                          <div>
                            <h4
                              style={{
                                margin: "14px 0 10px",
                                color: "#475569",
                              }}
                            >
                              Fotos
                            </h4>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fill, minmax(150px, 1fr))",
                                gap: "10px",
                              }}
                            >
                              {fotos.map((arquivo) => {
                                const url = obterUrlImagem(arquivo);
                                const selecionada = fotoEstaSelecionada(arquivo);

                                return (
                                  <div key={arquivo.id} style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        position: "relative",
                                        border: selecionada
                                          ? "3px solid #2563eb"
                                          : "1px solid #e2e8f0",
                                        borderRadius: "9px",
                                        overflow: "hidden",
                                        background: "#f8fafc",
                                        aspectRatio: "1 / 1",
                                      }}
                                    >
                                    {/* IMAGEM */}
                                    <button
                                      type="button"
                                      onClick={() => abrirFotoAmpliada(arquivo, url)}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        padding: 0,
                                        border: "none",
                                        background: "transparent",
                                        cursor: "zoom-in",
                                      }}
                                    >
                                      <img
                                        src={url}
                                        alt={arquivo.nome || "Foto"}
                                        loading="lazy"
                                        onError={(evento) =>
                                          tentarUrlAlternativaImagem(
                                            evento,
                                            arquivo
                                          )
                                        }
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                          display: "block",
                                        }}
                                      />
                                    </button>

                                    {/* CHECKBOX */}
                                    <label
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        position: "absolute",
                                        top: "8px",
                                        left: "8px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "30px",
                                        height: "30px",
                                        borderRadius: "7px",
                                        background: "rgba(255,255,255,0.94)",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                        cursor: salvandoSelecao
                                          ? "default"
                                          : "pointer",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selecionada}
                                        onChange={() =>
                                          alternarFoto(
                                            arquivo,
                                            resultado.frente
                                          )
                                        }
                                        disabled={salvandoSelecao}
                                        style={{
                                          width: "18px",
                                          height: "18px",
                                          cursor: "pointer",
                                        }}
                                      />
                                    </label>

                                    {/* INDICADOR */}
                                    {selecionada && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          right: "7px",
                                          top: "7px",
                                          width: "25px",
                                          height: "25px",
                                          borderRadius: "50%",
                                          background: "#2563eb",
                                          color: "#fff",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontWeight: 700,
                                          fontSize: "15px",
                                          pointerEvents: "none",
                                        }}
                                      >
                                        ✓
                                      </div>
                                    )}
                                    </div>
                                    {selecionada && (
                                      <textarea
                                        value={fotosSelecionadas[String(arquivo.id)]?.legenda || ""}
                                        lang="pt-BR"
                                        spellCheck={true}
                                        autoCorrect="on"
                                        autoCapitalize="sentences"
                                        onChange={(evento) =>
                                          atualizarLegendaFoto(arquivo.id, evento.target.value)
                                        }
                                        onClick={(evento) => evento.stopPropagation()}
                                        placeholder="Legenda que aparecerá no relatório"
                                        aria-label={`Legenda da foto ${arquivo.nome || arquivo.id}`}
                                        rows={2}
                                        disabled={salvandoSelecao}
                                        style={{
                                          width: "100%",
                                          minHeight: "58px",
                                          marginTop: "6px",
                                          padding: "7px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "6px",
                                          resize: "vertical",
                                          font: "inherit",
                                          fontSize: "12px",
                                        }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* VÍDEOS */}
                        {resultado.ok && videos.length > 0 && (
                          <div style={{ marginTop: "18px" }}>
                            <h4
                              style={{
                                margin: "0 0 10px",
                                color: "#475569",
                              }}
                            >
                              Vídeos
                            </h4>

                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              {videos.map((video) => (
                                <a
                                  key={video.id}
                                  href={obterUrlArquivo(video)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    padding: "10px 12px",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "7px",
                                    color: "#2563eb",
                                    textDecoration: "none",
                                  }}
                                >
                                  ▶ {video.nome}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SEM ARQUIVOS */}
                        {resultado.ok &&
                          resultado.encontrada !== false &&
                          fotos.length === 0 &&
                          videos.length === 0 && (
                            <div
                              style={{
                                padding: "14px",
                                color: "#64748b",
                                background: "#f8fafc",
                                borderRadius: "8px",
                              }}
                            >
                              Nenhum arquivo encontrado nesta pasta da
                              medição.
                            </div>
                          )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RODAPÉ */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                padding: "14px 22px",
                borderTop: "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            >
              <div style={{ color: "#475569", fontSize: "14px" }}>
                <strong>{totalFotosSelecionadas}</strong> foto(s) serão
                utilizadas no relatório fotográfico.
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={fecharModalFotos}
                  disabled={salvandoSelecao}
                  style={{
                    padding: "9px 16px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "7px",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={salvarSelecaoFotos}
                  disabled={
                    carregandoFotos ||
                    carregandoSelecao ||
                    salvandoSelecao
                  }
                  style={{
                    padding: "9px 18px",
                    border: "1px solid #2563eb",
                    borderRadius: "7px",
                    background: "#2563eb",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {salvandoSelecao ? "Salvando..." : "💾 Salvar seleção"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOTO AMPLIADA */}
      {fotoAmpliada && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            cursor: "zoom-out",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFotoAmpliada(null);
            }}
            style={{
              position: "absolute",
              top: "18px",
              right: "22px",
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: "30px",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "95vw",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <img
              src={fotoAmpliada.url}
              alt={fotoAmpliada.nome || "Foto ampliada"}
              onError={(evento) =>
                tentarUrlAlternativaImagem(evento, fotoAmpliada)
              }
              style={{
                maxWidth: "95vw",
                maxHeight: "82vh",
                objectFit: "contain",
                borderRadius: "6px",
              }}
            />

            <div
              style={{
                color: "#fff",
                fontSize: "13px",
                textAlign: "center",
                maxWidth: "90vw",
                wordBreak: "break-word",
              }}
            >
              {fotoAmpliada._carregandoOriginal && (
                <div style={{ color: "#fff", fontSize: "13px", textAlign: "center" }}>
                  Carregando foto em alta resolução…
                </div>
              )}
              {fotoAmpliada.nome}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
