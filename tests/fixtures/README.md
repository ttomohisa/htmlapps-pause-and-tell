# Common layout synthetic video fixture

`mobile-layout-video.webm.base64` is a 1.008-second, 160×120 solid-green video with a synthetic 440 Hz tone. It contains no user media. It is Base64-encoded only for repository transport; the browser test decodes it before using the normal file input.

The existing insertion smoke tests use FFmpeg-created WebM inputs. This fixture follows that method, so the file has a finite duration unlike an unfinalized MediaRecorder WebM stream. Generate it with an installed FFmpeg:

```sh
ffmpeg -v error -y -f lavfi -i 'color=c=0x16624f:size=160x120:rate=10:duration=1' -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=1' -c:v libvpx -deadline realtime -cpu-used 8 -b:v 100k -c:a libopus -b:a 32k -shortest synthetic.webm
base64 -w0 synthetic.webm > mobile-layout-video.webm.base64
```

Decoded SHA-256: `9eae5519489e245d8765bb5ebe7be87a1848954917820e3997a5f200dceec2d0`. The CI test verifies this exact fixture hash. No browser, camera, or microphone is needed to create it.
