import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const latencyTrend_ms = new Trend('latency_ms');

// export const options = {
//   vus: 150,
//   iterations: 150,
//   duration: '90s',
// };

export const options = {
  scenarios: {
    gradual_ramp_up: {
      executor: 'ramping-vus',  // 점진적으로 VU를 증가시키는 실행기
      startVUs: 0,              // 시작 VU 수
      stages: [
        { duration: '30s', target: 100 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

export default function () {
  const url = 'ws://localhost/chat';
  const res = ws.connect(url, {}, function (socket) {
  const maxMessages = 10;
  const from = 2;
  const range = 2;
    
    socket.on('open', function () {
      console.log('WebSocket 연결 성공');
      let messageCount = 0;
      
      // 2초마다 메시지 전송
      const intervalId = socket.setInterval(function () {
        if (messageCount < maxMessages) {
            const sender = 'user_' + __VU;
            const content = `Message ${messageCount} from user_${__VU} #${messageCount}`;
            const messageId = `${__VU}-${__ITER}-${Date.now()}`;
            const sentTime = Date.now();

            const message = JSON.stringify({
                sender: sender,
                content: content,
                messageId: messageId,
                sentTime: sentTime,
            });
            
            socket.send(message);
            console.log(content);
            messageCount++;
        } else {
          clearInterval(intervalId); // 메시지 전송 완료 시 연결 종료
          sleep(range * maxMessages);
          socket.close();
        }
      }, Math.random() * range * 1000 + from * 1000);
    });

    socket.on('message', function (message) {
      console.log('서버로부터 메시지 수신:', message);

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