import { encodeURL, createQR } from '@solana/pay';
import { FC, useEffect, useRef } from 'react';

type TransactionRequestQRProps = {
  instruction: string;
};

const queryBuilder = (baseUrl: string, params: string[][]) => {
  let url = baseUrl + '?';
  params.forEach((p, i) => url += p[0] + '=' + p[1] + (i != params.length - 1 ? '&' : ''));
  console.log(url)
  return url;
}

const PayQR: FC<TransactionRequestQRProps> = (
  { instruction }
) => {
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const params = [
      ['instruction', instruction],
    ];

    const apiUrl = queryBuilder(
      `${window.location.protocol}//${window.location.host}/api/transaction`,
      params,
    );

    const qr = createQR(
      encodeURL({ link: new URL(apiUrl) }),
      360,
      'transparent'
    );

    qr.update({ backgroundOptions: { round: 1000 } });
    qr.update({ type: 'canvas' });

    if (qrRef.current != null) {
      qrRef.current.innerHTML = '';
      qr.append(qrRef.current)
    }

  }, [])

  return (
    <div className='bg-white shadow-md rounded-2xl border-solid border border-black w-auto text-center flex flex-col justify-between mx-auto'>

      <div className='justify-self-start m-2 mt-4'>
        <p>{instruction}</p>
      </div>

      <div ref={qrRef} className='rounded-xl overflow-hidden'></div>

    </div>
  );
};

export default PayQR;
