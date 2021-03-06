import { useEffect, useState } from 'react';
import { notification } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { UpdateAccountModal } from '../../components/updateAccountModal/UpdateAccountModal';
import { transformDate } from '../../utils/utils';
import { LoadingSpinner } from './../../components/loadingSpinner/LoadingSpinner';
import { LabeledText } from '../../components/labeledText/LabeledText';
import { AccountStats } from '../../components/accountStats/AccountStats';
import { Divider } from './../../components/divider/Divider';
import { SingleTooltipIconButton } from '../../components/singleTooltipIconButton/SingleTooltipIconButton';
import { getRequest, patchRequest } from './../../api/utils';
import styles from './AccountPage.module.scss';
import avatar from '../../assets/avatar.png';

export const AccountPage = () => {
    const [userData, setUserData] = useState({});
    const [isModalShown, setIsModalShown] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(true);

    useEffect(() => {
        if (!isModalShown) {
            setIsFetchingData(true);
            getRequest('/users/1').then((data) => {
                setUserData(data);
                setIsFetchingData(false);
            }).catch(error => {
                notification.error({
                    message: `Bład!`,
                    description: `${error.message}`,
                    placement: 'bottomRight',
                    style: {backgroundColor: '#ffc4c4'},
                });
            });
        }
        
    }, [isModalShown]);

    const handleShowModal = () => {
        setIsModalShown(true);
    }

    const handleCloseModal = () => {
        setIsModalShown(false);
    }

    const handleOkModal = (inputs) => {
        patchRequest('/users/1', inputs)
        .then(() => {
            handleCloseModal();
            notification.success({
                message: `Sukces!`,
                description: 'Pomyślnie zaktualizowano profil!',
                placement: 'bottomRight',
                style: {backgroundColor: '#c2ffd2'},
            });
        }).catch(error => {
            notification.error({
                message: `Bład!`,
                description: `${error.message}`,
                placement: 'bottomRight',
                style: {backgroundColor: '#ffc4c4'},
            });
        });
    }

    if (!isFetchingData && userData) {
        return (
            <>
                <div className={styles.root}>
                    <SingleTooltipIconButton
                        type='primary'
                        text='Edytuj'
                        tooltipTitle='Edytuj profil'
                        icon={<EditOutlined />}
                        onClick={() => handleShowModal()}
                        right='1rem'
                    />
    
                    <img src={avatar} alt='no_image' width={150}></img>
                    <h3 className='pt-3'>{userData.user.imie} {userData.user.nazwisko}</h3>

                    <Divider />

                    <AccountStats
                        totalBadges={userData.totalBadges}
                        totalTrips={userData.totalTrips}
                        totalPoints={userData.totalPoints}
                    />
    
                    <div className='mt-5'>
                        <LabeledText 
                            labelText='Rola:' 
                            text={userData.user.rolanazwa}
                            fontSize='1.5rem'
                        />

                        <LabeledText 
                            labelText='Login:' 
                            text={userData.user.login}
                            fontSize='1.5rem'
                        />

                        <LabeledText 
                            labelText='Data urodzenia:' 
                            text={transformDate(userData.user.dataurodzenia)}
                            fontSize='1.5rem'
                        />
                    </div>
                </div>
    
                {
                    !isFetchingData && isModalShown &&
                    <UpdateAccountModal 
                        visible={isModalShown} 
                        handleCancel={handleCloseModal}
                        handleOk={handleOkModal}
                        name={userData.user.imie}
                        surname={userData.user.nazwisko}
                        login={userData.user.login}
                        password={userData.user.haslo}
                    />
                }
            </>
        );
    }

    else {
        return <LoadingSpinner />;
    }
    
};
