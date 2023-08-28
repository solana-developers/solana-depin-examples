import { FC, useEffect, useRef } from 'react';

const PayQR: FC<any> = (
  { receipts }
) => {

  console.log(JSON.stringify(receipts));

  return (

    <div className='bg-white shadow-md rounded-2xl border-solid border border-black w-auto text-center flex flex-col mx-auto'>
          <p>Receipts:</p>
          {receipts && receipts.receipts.map(receipt =>
                        <tr key={receipt.receiptId}>
                            <td>{receipt.receiptId.toString()}</td>
                            <td>{receipt.wasDelivered ? "Done: " : "Pending: "}</td>
                            <td>{receipt.buyer.toString()}</td>
                        </tr>
                    )}
    </div>
  );
};

export default PayQR;
