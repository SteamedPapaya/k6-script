import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const latencyTrend_ms = new Trend('latency_ms');
// const VUS = parseInt(__ENV.VUS);

// export const options = {
//   vus: 150,
//   iterations: 150,
//   duration: '90s',
// };

export const options = {
//   scenarios: {
//     gradual_ramp_up: {
//       executor: 'ramping-vus',  // 점진적으로 VU를 증가시키는 실행기
//       startVUs: 0,              // 시작 VU 수
//       stages: [
//         { duration: '60s', target: 300 },
//         { duration: '30s', target: 300 },
//         { duration: '30s', target: 0 },
//       ],
//     },
//   },

// vus: 10,
// iterations: 10,

  scenarios: {
    // 시나리오 1: 테스트 시작 시 50 VU 추가
    stage1: {
      executor: 'per-vu-iterations',
      // exec: 'function',
      vus: __ENV.VUS,
      iterations: 1, // 각 VU당 반복 횟수
      maxDuration: '3m',
      gracefulStop: '3s',
      startTime: '0s', // 즉시 시작
      tags: { stage: 'stage1' },
    },
    // 시나리오 2: 2분 후에 추가로 50 VU 추가
    stage2: {
      executor: 'per-vu-iterations',
      // exec: 'function',
      vus: __ENV.VUS,
      iterations: 1,
      maxDuration: '3m',
      gracefulStop: '3s',
      startTime: '10s',
      tags: { stage: 'stage2' },
    },
    stage3: {
      executor: 'per-vu-iterations',
      // exec: 'function',
      vus: __ENV.VUS,
      iterations: 1,
      maxDuration: '3m',
      gracefulStop: '3s',
      startTime: '20s',
      tags: { stage: 'stage3' },
    },
    stage4: {
      executor: 'per-vu-iterations',
      // exec: 'function',
      vus: __ENV.VUS,
      iterations: 1,
      maxDuration: '3m',
      gracefulStop: '3s',
      startTime: '30s', // 후 시작
      tags: { stage: 'stage4' },
    },
    stage5: {
      executor: 'per-vu-iterations',
      // exec: 'function',
      vus: __ENV.VUS,
      iterations: 1,
      maxDuration: '3m',
      gracefulStop: '3s',
      startTime: '40s', // 후 시작
      tags: { stage: 'stage5' },
    },
    // per_vu_iterations: {
    //   executor: 'per-vu-iterations',
    //   vus: 300, // 최대 VU 수
    //   iterations: 1, // 각 VU당 반복 횟수
    //   maxDuration: '180s', // 최대 테스트 지속 시간
    //   gracefulStop: '3s', // 종료 시 30초의 유예 기간
    // },
  },
  env: {
    // WS_URL: 'ws://localhost:8080/chat',
    // MAX_MESSAGES: '10',
    // FROM: '2',
    // RANGE: '4',
    // VUS: '25'
  },
};

export default function () {
  const url = 'ws://localhost/chat';  // WebSocket 서버 URL


  const res = ws.connect(url, {}, function (socket) {
    const maxMessages = 10;
    const from = 2;
    const range = 4;
  
    socket.on('open', function () {
      console.log('WebSocket 연결 성공');      
      let messageCount = 0;
      const intervalId = socket.setInterval(function () {
        if (messageCount < maxMessages) {
            const sender = 'user_' + __VU;
            const largeMessage = 'a'.repeat(1024);
            const content = `Message ${messageCount} from user_${__VU} #${messageCount}`;
            const messageId = `${__VU}-${__ITER}-${Date.now()}`;
            const sentTime = Date.now();

            const message = JSON.stringify({
                sender: sender,
                content: largeMessage,
                messageId: messageId,
                sentTime: sentTime,
            });
            
            socket.send(message);
            // console.log(content);
            messageCount++;
        } else {
          clearInterval(intervalId); // 메시지 전송 완료 시 연결 종료
          sleep(range * maxMessages);
          socket.close();
        }
      }, Math.random() * range * 1000 + from * 1000);
    });

    socket.on('message', function (message) {
      // console.log('서버로부터 메시지 수신:', message);

      try {
        const receivedMessage = JSON.parse(message);
        const latency = Date.now() - receivedMessage.sentTime;
        console.log(`서버로부터 메시지 수신 ID: ${receivedMessage.messageId} Latency: ${latency}ms`);

        check(receivedMessage, { '메시지 수신 여부': (msg) => msg.content !== '' });

        // 지연 시간을 Trend 메트릭에 기록
        latencyTrend_ms.add(latency);

        // 메시지 수신 후 연결 종료
        // socket.close();
      } catch (e) {
        console.error(`메시지 파싱 오류: ${e.message}`);
      }
    });

    socket.on('close', function () {
      console.log('WebSocket 연결 종료');
    });

    socket.on('error', function (e) {
      console.log('WebSocket 에러:', e.error());
    });
  });

  check(res, { '연결 성공 여부': (r) => r && r.status === 101 });
}