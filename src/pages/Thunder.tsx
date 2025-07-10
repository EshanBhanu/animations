import Lightning from '../components/ThunderComp';

const Thunder = () => {
  return (
    <div className="fixed inset-0 w-screen h-screen m-0 p-0 overflow-hidden z-[1000]">
      <Lightning hue={220} xOffset={0} speed={1} intensity={1} size={1} />
    </div>
  );
}

export {Thunder}