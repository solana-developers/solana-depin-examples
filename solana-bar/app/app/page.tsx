'use client'; // this makes next know that this page should be rendered in the client
import { useEffect, useState } from 'react';
import { CONNECTION, SOLANA_BAR_PROGRAM_ID, SOLANA_BAR_PROGRAM, RECEIPTS_PDA } from '@/src/util/const';
import PayQR from '@/src/components/PayQR';
import Receipts from '@/src/components/Receipts';

export default function Home() {
  const [receipts, setReceipts] = useState<any>()

  useEffect(() => {

    CONNECTION.onAccountChange(
      RECEIPTS_PDA,
      (updatedAccountInfo, context) => {
        {
          const decoded = SOLANA_BAR_PROGRAM.coder.accounts.decode(
            "receipts",
            updatedAccountInfo.data
          )
          setReceipts(decoded);
        }
      },
      "confirmed"
    );

    const getState = async () => {
      const gameData = await SOLANA_BAR_PROGRAM.account.receipts.fetch(
        RECEIPTS_PDA,
      );
      setReceipts(gameData);
    };

    getState();

  }, []);

  return (
    <main className='min-h-screen bg-blue-500 p-2'>
      {<div className="w-full min-h-screen bg-no-repeat bg-cover bg-center bg-fixed bg-[url('../public/bg.jpg')]">
        <div className="w-full min-h-screen bg-no-repeat bg-cover bg-center bg-fixed bg-blue-900 bg-opacity-60 pt-4">

          <div className='flex flex-col justify-center'>

            <div className='bg-white shadow-md rounded-2xl border-solid border border-black mx-auto w-fit p-2 mb-2'>
              <div className='text-center px-3 pb-6 pt-2'>
                <p className='text-sm text-gray-700 my-4'>
                  Solana Bar
                  <br></br>
                  Scan the QR code to buy a shot via a Solana pay transaction request.
                </p>

                <h2 className='mt-8 text-4xl'>
                  
                </h2>

              </div>
            </div>

            <li className='flex flex-row justify-between mx-10 text-xl my-4'>

              {receipts != null && (
                <PayQR instruction={"buy_shot"} />
              )}

              {!receipts && (
                <PayQR instruction={"initialize"} />
              )}
              
              <Receipts receipts = {receipts} ></Receipts>
                  
            </li>
          </div>          
        </div>       
      </div>}
    </main>
  );
}
