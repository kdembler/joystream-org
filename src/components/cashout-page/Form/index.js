import React, { useState } from 'react';
import cn from 'classnames';
import axios from 'axios';

import Input from './Input';
import AmountInput from './AmountInput';
import { ArrowButton } from '../../../pages/founding-members/index';
import Notice from './Notice';
import Loader from 'react-loader-spinner';
import FinalScreen, {
  FINAL_UI_STATE_SERVERDOWN,
  FINAL_UI_STATE_SERVERPROBLEM
} from './FinalScreen';
import Success from './Success';

//util
import {
  validateBchAddress,
  validateUser,
  validateJoystreamAddress,
  validateTokenAmount,
  validateEmail,
} from './util/validation';

import './style.scss';

export const CASHOUT_SERVER_URL = "";
export const INITIATE_CASHOUT_ROUTE = "initiate-cashout";
export const CASHOUT_ROUTE = "cashout";

const ERROR_TYPE_PROCESSING = "PROCESSING";

const CashoutForm = ({ Api, joyInDollars, bchInDollars, statusServerError, apiError }) => {
  const [joystreamAddress, setJoystreamAddress] = useState({ value: '', error: null });
  const [tokenAmount, setTokenAmount] = useState({ value: '', error: null });
  const [bchAddress, setBchAddress] = useState({ value: '', error: null, warning: null });
  const [email, setEmail] = useState({ value: '', error: null });
  const [joystreamHandle, setJoystreamHandle] = useState({ value: '', error: null });
  const [cashoutInitiationResponse, setCashoutInitiationResponse] = useState(null);
  const [cashoutResponse, setCashoutResponse] = useState(null);

  // state-derived variables
  const formIsFilled =
    !!joystreamAddress.value && !!tokenAmount.value && !!bchAddress.value && !!email.value && !!joystreamHandle.value;
  const formIsLoading = !(Api && joyInDollars) || cashoutInitiationResponse?.loading || cashoutResponse?.loading;

  const formFinalizationState = () => {
    if(cashoutResponse?.success) {
      const { success, dollarAmount } = cashoutResponse;

      return { state: success, props: { dollarAmount } };
    }

    if(cashoutResponse?.error) {
      return { state: cashoutResponse.error };
    }

    if(cashoutInitiationResponse?.error) {
      return { state: cashoutInitiationResponse.error };
    }

    if (statusServerError || apiError) {
      return { state: FINAL_UI_STATE_SERVERDOWN };
    }

    return null;
  };

  const validateForm = async () => {
    const trimmedEmail = email.value.trimStart().trimEnd();

    const joystreamAddressError = validateJoystreamAddress(joystreamAddress.value);
    const tokenAmountError = validateTokenAmount(tokenAmount.value);
    const bchAddressError = validateBchAddress(bchAddress.value);
    const emailError = validateEmail(trimmedEmail);
    const userError = await validateUser(Api, joystreamHandle.value, joystreamAddress.value);

    const isValidBchAddress = !bchAddressError || !!bchAddressError?.warningMessage;

    // validate address
    if (!joystreamAddressError) {
      setJoystreamAddress(prev => ({ ...prev, error: null }));
    } else {
      setJoystreamAddress(prev => ({ ...prev, error: joystreamAddressError }));
    }

    // validate token amount
    if (!tokenAmountError) {
      setTokenAmount(prev => ({ ...prev, error: null }));
    } else {
      setTokenAmount(prev => ({ ...prev, error: tokenAmountError }));
    }

    // validate BCH address
    if (isValidBchAddress) {
      setBchAddress(prev => ({
        ...prev,
        error: null,
        ...(bchAddressError?.warningMessage && { warning: bchAddressError.warningMessage }),
      }));
    } else {
      setBchAddress(prev => ({ ...prev, error: bchAddressError?.errorMessage }));
    }

    if (!emailError) {
      setEmail({ value: trimmedEmail, error: null });
    } else {
      setEmail(prev => ({ ...prev, error: emailError }));
    }

    if (!userError) {
      setJoystreamHandle(prev => ({ ...prev, error: null }));
    } else {
      setJoystreamHandle(prev => ({ ...prev, error: userError }));
    }

    return !joystreamAddressError && !tokenAmountError && isValidBchAddress && !emailError && !userError;
  }

  const submit = async () => {
    const isDataValid = await validateForm();

    if (isDataValid) {
      setCashoutInitiationResponse({ loading: true });

      try {
        const response = await axios.post(CASHOUT_SERVER_URL + INITIATE_CASHOUT_ROUTE, {
          joystreamAddress: joystreamAddress.value,
          tokenAmount: tokenAmount.value,
          bchAddress: bchAddress.value,
          email: email.value,
          joystreamHandle: joystreamHandle.value
        });

        if(response.status === 200) {
          const { timeoutTimestamp, joystreamAddress } = response.data;

          setCashoutInitiationResponse({ success: { timeoutTimestamp, joystreamAddress }, loading: false });
        }
      } catch (e) {
        // Axios throws an error for 4xx and 5xx error codes. That is why
        // we're dealing with those in the catch block.

        if(e?.response?.status === 400 && e?.response?.data?.errorType === ERROR_TYPE_PROCESSING) {
          const { joystreamAddress, tokenAmount } = e.response.data;

          setCashoutInitiationResponse({
            alreadyCashingOut: { tokenAmount, joystreamAddress },
            loading: false,
          });
          return;
        }

        if(e?.response?.status === 400) {
          // TODO: If just 400 then it's a validation error. (Shouldn't happen!)
          setCashoutInitiationResponse({ loading: false });
          return;
        }

        if(e?.response?.status === 500) {
          setCashoutInitiationResponse({ error: FINAL_UI_STATE_SERVERPROBLEM, loading: false });
          return;
        }
      }
    }
  };

  const renderBody = () => (
    <div
      className={cn('CashoutPage__form__body', {
        'CashoutPage__form__body--loading': formIsLoading,
      })}
    >
      <Input
        id="joystreamAddress"
        label="Send from"
        placeholder="Testnet address"
        updateValue={setJoystreamAddress}
        errorMessage={joystreamAddress.error}
        info="tJOY Account address"
        disabled={formIsLoading || cashoutInitiationResponse?.success}
      />
      <AmountInput
        id="tokenAmount"
        label="Amount"
        placeholder="Amount"
        updateValue={setTokenAmount}
        errorMessage={tokenAmount.error}
        joyInDollars={joyInDollars}
        bchInDollars={bchInDollars}
        disabled={formIsLoading || cashoutInitiationResponse?.success}
      />
      <Input
        id="bchAddress"
        label="Destination address"
        placeholder="Account address"
        updateValue={setBchAddress}
        errorMessage={bchAddress.error}
        warning={bchAddress.warning}
        info="BCH Account address"
        disabled={formIsLoading || cashoutInitiationResponse?.success}
      />
      <Input
        id="email"
        label="Email"
        placeholder="Email"
        inputType="text"
        updateValue={setEmail}
        errorMessage={email.error}
        info="Optional"
        help="Help us to contact you in case of any problems"
        disabled={formIsLoading || cashoutInitiationResponse?.success}
      />
      <Input
        id="joystreamHandle"
        label="Joystream Handle/ID"
        placeholder="Handle/ID"
        updateValue={setJoystreamHandle}
        errorMessage={joystreamHandle.error}
        info="Optional"
        help="Help us to contact you in case of any problems"
        disabled={formIsLoading || cashoutInitiationResponse?.success}
      />
      {cashoutInitiationResponse?.alreadyCashingOut ? (
        <Notice data={cashoutInitiationResponse.alreadyCashingOut} />
      ) : null}
      {!formIsLoading && cashoutInitiationResponse?.success ? (
        <Success {...cashoutInitiationResponse.success} setCashoutResponse={setCashoutResponse} />
      ) : null}
      {formIsLoading ? (
        <Loader
          className="CashoutPage__form__body__loader"
          type="Oval"
          color="#302ABF"
          secondaryColor="#00000"
          height="100%"
          width="100%"
          timeout={0}
        />
      ) : null}
      {!formIsLoading && !cashoutInitiationResponse?.success ? (
        <ArrowButton
          text="Submit"
          className={cn('CashoutPage__form__body__button', {
            'CashoutPage__form__body__button--active': formIsFilled,
          })}
          onClick={() => {
            if (formIsFilled && Api) {
              submit();
            }
          }}
        />
      ) : null}
    </div>
  );

  return (
    <div className="CashoutPage__form-wrapper">
      <div className="CashoutPage__form">
        <header className="CashoutPage__form__header">
          <h2 className="CashoutPage__form__header__title">Withdraw details</h2>
        </header>
        {formFinalizationState() ? <FinalScreen {...formFinalizationState()} /> : renderBody()}
      </div>
    </div>
  );
};

export default CashoutForm;
